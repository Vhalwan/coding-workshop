import json, logging, os, jwt
from postgres_service import (init_db, create_resource, get_all_resources, get_resource_by_id,
    update_resource, delete_resource, create_allocation, get_allocations, delete_allocation, reset_connection)
logger = logging.getLogger()
logger.setLevel(logging.INFO)
IS_LOCAL = os.getenv("IS_LOCAL", "false") == "true"
JWT_SECRET = os.getenv("JWT_SECRET", "workshop-secret-key-change-in-prod")
PG_CONFIG = (f"host={os.getenv('POSTGRES_HOST','localhost')} port={os.getenv('POSTGRES_PORT','5432')} "
    f"user={os.getenv('POSTGRES_USER','postgres')} password={os.getenv('POSTGRES_PASS','postgres')} "
    f"dbname={os.getenv('POSTGRES_NAME','postgres')} connect_timeout=15" + ("" if IS_LOCAL else " sslmode=require"))

def parse_event(event):
    if event.get("version") == "2.0" or "requestContext" in event:
        ctx = event.get("requestContext", {}).get("http", {})
        return ctx.get("method", "GET").upper(), event.get("rawPath") or ctx.get("path", "/")
    return event.get("httpMethod", "GET").upper(), event.get("path", "/")

def resp(code, body): return {"statusCode": code, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"}, "body": json.dumps(body, default=str)}
def err(code, msg): return resp(code, {"error": msg})

def get_user(event):
    h = event.get("headers") or {}
    auth = h.get("Authorization") or h.get("authorization", "")
    if not auth.startswith("Bearer "): return None
    try: return jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
    except: return None

def handler(event=None, context=None):
    try: init_db(PG_CONFIG)
    except: reset_connection(); return err(500, "DB init failed")
    method, path = parse_event(event)
    parts = [p for p in path.strip("/").split("/") if p]
    user = get_user(event)
    if not user and method != "OPTIONS": return err(401, "Authentication required")
    if method == "OPTIONS": return resp(200, {})
    try:
        params = event.get("queryStringParameters") or {}
        last = parts[-1] if parts else ""
        is_uuid = len(last) == 36 and last.count("-") == 4
        is_allocation = "allocations" in parts
        if is_allocation:
            if method == "GET":
                return resp(200, {"allocations": get_allocations(PG_CONFIG, resource_id=params.get("resource_id"), project_id=params.get("project_id"))})
            if method == "POST":
                body = json.loads(event.get("body") or "{}")
                if not all([body.get("resource_id"), body.get("project_id"), body.get("hours_per_week")]):
                    return err(400, "resource_id, project_id, and hours_per_week are required")
                return resp(201, {"allocation": create_allocation(PG_CONFIG, body)})
            if method == "DELETE" and is_uuid:
                if user.get("role") not in ("admin", "manager"):
                    return err(403, "Manager or Admin role required")
                return resp(204, {}) if delete_allocation(PG_CONFIG, last) else err(404, "Not found")
        if method == "GET" and not is_uuid:
            return resp(200, {"resources": get_all_resources(PG_CONFIG)})
        if method == "GET" and is_uuid:
            r = get_resource_by_id(PG_CONFIG, last)
            return resp(200, {"resource": r}) if r else err(404, "Not found")
        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            if not body.get("name") or not body.get("email"): return err(400, "name and email are required")
            return resp(201, {"resource": create_resource(PG_CONFIG, body)})
        if method == "PUT" and is_uuid:
            body = json.loads(event.get("body") or "{}")
            r = update_resource(PG_CONFIG, last, body)
            return resp(200, {"resource": r}) if r else err(404, "Not found")
        if method == "DELETE" and is_uuid:
            if user.get("role") not in ("admin","manager"): return err(403, "Manager or Admin role required")
            return resp(204, {}) if delete_resource(PG_CONFIG, last) else err(404, "Not found")
        return err(404, f"Not found: {method} {path}")
    except Exception as e:
        logger.error("Error: %s", e); reset_connection(); return err(500, str(e))
