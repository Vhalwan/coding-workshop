import json, logging, os, jwt
from postgres_service import (init_db, create_deliverable, get_deliverables, get_deliverable_by_id,
    update_deliverable, delete_deliverable, add_dependency, remove_dependency, reset_connection)
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
        if "dependencies" in parts:
            dep_idx = parts.index("dependencies")
            deliverable_id = parts[dep_idx - 1]
            if user.get("role") == "viewer":
                return err(403, "Viewers cannot modify dependencies")
            if method == "POST" and dep_idx == len(parts) - 1:
                body = json.loads(event.get("body") or "{}")
                depends_on_id = body.get("depends_on_id")
                if not depends_on_id:
                    return err(400, "depends_on_id is required")
                try:
                    dep = add_dependency(PG_CONFIG, deliverable_id, depends_on_id)
                except ValueError as e:
                    return err(400, str(e))
                if dep is None:
                    return err(404, "Deliverable not found")
                return resp(201, {"dependency": dep})
            if method == "DELETE" and dep_idx == len(parts) - 2:
                depends_on_id = parts[dep_idx + 1]
                if remove_dependency(PG_CONFIG, deliverable_id, depends_on_id):
                    return resp(204, {})
                return err(404, "Dependency not found")
            return err(404, f"Not found: {method} {path}")
        if method == "GET" and not is_uuid:
            return resp(200, {"deliverables": get_deliverables(PG_CONFIG, project_id=params.get("project_id"), status=params.get("status"))})
        if method == "GET" and is_uuid:
            d = get_deliverable_by_id(PG_CONFIG, last)
            return resp(200, {"deliverable": d}) if d else err(404, "Not found")
        if method == "POST":
            if user.get("role") == "viewer":
                return err(403, "Viewers cannot create records")
            body = json.loads(event.get("body") or "{}")
            if not body.get("name"): return err(400, "name is required")
            if not body.get("project_id"): return err(400, "project_id is required")
            return resp(201, {"deliverable": create_deliverable(PG_CONFIG, body)})
        if method == "PUT" and is_uuid:
            body = json.loads(event.get("body") or "{}")
            d = update_deliverable(PG_CONFIG, last, body)
            return resp(200, {"deliverable": d}) if d else err(404, "Not found")
        if method == "DELETE" and is_uuid:
            if user.get("role") not in ("admin","manager"): return err(403, "Manager or Admin role required")
            return resp(204, {}) if delete_deliverable(PG_CONFIG, last) else err(404, "Not found")
        return err(404, f"Not found: {method} {path}")
    except Exception as e:
        logger.error("Error: %s", e); reset_connection(); return err(500, str(e))
