"""
Auth service - handles user registration, login, and token verification.
"""
import json
import logging
import os
import hashlib
import hmac
import secrets
import jwt
from datetime import datetime, timezone, timedelta
from postgres_service import init_db, create_user, get_user_by_email, get_user_by_id, get_all_users, reset_connection

logger = logging.getLogger()
logger.setLevel(logging.INFO)

IS_LOCAL = os.getenv("IS_LOCAL", "false") == "true"
JWT_SECRET = os.getenv("JWT_SECRET", "workshop-secret-key-change-in-prod")
JWT_EXPIRY_HOURS = 24

PG_CONFIG = (
    f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
    f"port={os.getenv('POSTGRES_PORT', '5432')} "
    f"user={os.getenv('POSTGRES_USER', 'postgres')} "
    f"password={os.getenv('POSTGRES_PASS', 'postgres')} "
    f"dbname={os.getenv('POSTGRES_NAME', 'postgres')} "
    f"connect_timeout=15"
    + ("" if IS_LOCAL else " sslmode=require")
)

def hash_password(password):
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260000)
    return f"pbkdf2:sha256:260000:{salt}:{key.hex()}"

def verify_password(password, stored):
    try:
        _, _, iterations, salt, key_hex = stored.split(':')
        key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), int(iterations))
        return hmac.compare_digest(key.hex(), key_hex)
    except Exception:
        return False

def parse_event(event):
    """Normalize API GW v1, v2, and Lambda URL events into method + path."""
    # v2 / Lambda URL format
    if event.get("version") == "2.0" or "requestContext" in event:
        ctx = event.get("requestContext", {}).get("http", {})
        method = ctx.get("method", "GET").upper()
        path = event.get("rawPath") or ctx.get("path", "/")
    else:
        # v1 format
        method = event.get("httpMethod", "GET").upper()
        path = event.get("path", "/")
    return method, path

def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps(body, default=str)
    }

def error(status_code, message):
    return response(status_code, {"error": message})

def generate_token(user):
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None

def get_token_from_event(event):
    headers = event.get("headers") or {}
    auth = headers.get("Authorization") or headers.get("authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None

def handler(event=None, context=None):
    try:
        init_db(PG_CONFIG)
    except Exception as e:
        logger.error("DB init failed: %s", e)
        reset_connection()
        return error(500, "Database initialization failed")

    method, path = parse_event(event)
    # Normalize: strip leading slash, get last segment
    segment = path.strip("/").split("/")[-1] if path.strip("/") else ""

    if method == "OPTIONS":
        return response(200, {})

    try:
        if method == "POST" and segment == "register":
            body = json.loads(event.get("body") or "{}")
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""
            full_name = (body.get("full_name") or "").strip()
            role = body.get("role", "viewer")
            if not email or not password or not full_name:
                return error(400, "email, password, and full_name are required")
            if len(password) < 6:
                return error(400, "password must be at least 6 characters")
            if role not in ("admin", "manager", "contributor", "viewer"):
                return error(400, "role must be admin, manager, contributor, or viewer")
            if get_user_by_email(PG_CONFIG, email):
                return error(400, "Email already registered")
            pw_hash = hash_password(password)
            user = create_user(PG_CONFIG, email, pw_hash, full_name, role)
            token = generate_token(user)
            return response(201, {"user": user, "token": token})

        if method == "POST" and segment == "login":
            body = json.loads(event.get("body") or "{}")
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""
            if not email or not password:
                return error(400, "email and password are required")
            user = get_user_by_email(PG_CONFIG, email)
            if not user or not verify_password(password, user["password_hash"]):
                return error(401, "Invalid email or password")
            token = generate_token(user)
            del user["password_hash"]
            return response(200, {"user": user, "token": token})

        if method == "POST" and segment == "verify":
            token = get_token_from_event(event)
            if not token:
                return error(401, "No token provided")
            payload = verify_token(token)
            if not payload:
                return error(401, "Invalid or expired token")
            user = get_user_by_id(PG_CONFIG, payload["sub"])
            if not user:
                return error(404, "User not found")
            return response(200, {"valid": True, "user": user})

        if method == "GET" and segment == "users":
            token = get_token_from_event(event)
            if not token:
                return error(401, "Authentication required")
            payload = verify_token(token)
            if not payload:
                return error(401, "Invalid or expired token")
            if payload.get("role") != "admin":
                return error(403, "Admin access required")
            users = get_all_users(PG_CONFIG)
            return response(200, {"users": users})

        logger.warning("No route matched: %s %s (segment=%s)", method, path, segment)
        return error(404, f"Endpoint not found: {method} {path}")

    except Exception as e:
        logger.error("Handler error: %s", e)
        reset_connection()
        return error(500, str(e))
