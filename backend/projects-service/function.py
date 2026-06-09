import json, logging, os, jwt
from postgres_service import init_db, create_project, get_all_projects, get_project_by_id, update_project, delete_project, reset_connection
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
        # GET /projects or GET /projects/
        if method == "GET" and (not parts or parts[-1] == "projects"):
            return resp(200, {"projects": get_all_projects(PG_CONFIG, status=params.get("status"))})
        # GET /projects/{id}
        if method == "GET" and len(parts) >= 1:
            p = get_project_by_id(PG_CONFIG, parts[-1])
            return resp(200, {"project": p}) if p else err(404, "Project not found")
        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            if not body.get("name"): return err(400, "name is required")
            body.setdefault("owner_id", user.get("sub")); body.setdefault("owner_name", user.get("email"))
            return resp(201, {"project": create_project(PG_CONFIG, body)})
        if method == "PUT" and len(parts) >= 1:
            if user.get("role") not in ("admin","manager"): return err(403, "Manager or Admin role required")
            body = json.loads(event.get("body") or "{}")
            p = update_project(PG_CONFIG, parts[-1], body)
            return resp(200, {"project": p}) if p else err(404, "Project not found")
        if method == "DELETE" and len(parts) >= 1:
            if user.get("role") not in ("admin","manager"): return err(403, "Manager or Admin role required")
            return resp(204, {}) if delete_project(PG_CONFIG, parts[-1]) else err(404, "Project not found")
        return err(404, f"Not found: {method} {path}")
    except Exception as e:
        logger.error("Error: %s", e); reset_connection(); return err(500, str(e))
