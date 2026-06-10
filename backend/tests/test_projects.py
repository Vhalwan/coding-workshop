import json, sys, os, importlib.util
from unittest.mock import patch

def load_module(name, filepath):
    spec = importlib.util.spec_from_file_location(name, filepath)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

d = os.path.dirname(__file__)
# Load auth service
load_module("postgres_service", f"{d}/../auth-service/postgres_service.py")
load_module("mongo_service", f"{d}/../auth-service/mongo_service.py") if os.path.exists(f"{d}/../auth-service/mongo_service.py") else None
auth_mod = load_module("auth_fn", f"{d}/../auth-service/function.py")

def tok(role="admin"):
    return auth_mod.generate_token({"id": "u1", "email": "a@b.com", "role": role})

def ev(method, path, body=None, token=None):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    return {"httpMethod": method, "path": path, "headers": h,
            "body": json.dumps(body) if body else None, "queryStringParameters": {}}


# Reload postgres_service from projects-service before loading service
load_module("postgres_service", f"{d}/../projects-service/postgres_service.py")
svc_mod = load_module("projects-service_fn", f"{d}/../projects-service/function.py")

def test_parse_event_v1():
    method, path = svc_mod.parse_event({"httpMethod": "GET", "path": "/projects"})
    assert method == "GET" and path == "/projects"

def test_parse_event_v2():
    method, path = svc_mod.parse_event({"version": "2.0", "rawPath": "/projects",
        "requestContext": {"http": {"method": "GET", "path": "/projects"}}})
    assert method == "GET" and path == "/projects"

def test_no_auth():
    with patch.object(svc_mod, "init_db"):
        assert svc_mod.handler(ev("GET", "/projects"))["statusCode"] == 401

def test_options():
    with patch.object(svc_mod, "init_db"):
        assert svc_mod.handler(ev("OPTIONS", "/projects"))["statusCode"] == 200

def test_post_missing_name():
    with patch.object(svc_mod, "init_db"):
        r = svc_mod.handler(ev("POST", "/projects", {"description": "no name"}, tok()))
        assert r["statusCode"] == 400

def test_viewer_cannot_delete():
    token = auth_mod.generate_token({"id": "u2", "email": "v@b.com", "role": "viewer"})
    with patch.object(svc_mod, "init_db"):
        r = svc_mod.handler(ev("DELETE", "/projects/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", token=token))
        assert r["statusCode"] == 403

def test_viewer_cannot_update():
    token = auth_mod.generate_token({"id": "u2", "email": "v@b.com", "role": "viewer"})
    with patch.object(svc_mod, "init_db"):
        r = svc_mod.handler(ev("PUT", "/projects/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", {"name": "x"}, token=token))
        assert r["statusCode"] == 403

def test_cors_headers():
    with patch.object(svc_mod, "init_db"):
        assert "Access-Control-Allow-Origin" in svc_mod.handler(ev("OPTIONS", "/projects"))["headers"]
