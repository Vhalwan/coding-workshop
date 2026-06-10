import json, sys, os, importlib.util
from unittest.mock import patch

def load_module(name, filepath):
    spec = importlib.util.spec_from_file_location(name, filepath)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

d = os.path.dirname(__file__)
load_module("postgres_service", f"{d}/../auth-service/postgres_service.py")
auth_mod = load_module("auth_fn", f"{d}/../auth-service/function.py")

def tok(role="admin"):
    return auth_mod.generate_token({"id": "u1", "email": "a@b.com", "role": role})

def ev(method, path, body=None, token=None):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    return {"httpMethod": method, "path": path, "headers": h,
            "body": json.dumps(body) if body else None, "queryStringParameters": {}}

load_module("postgres_service", f"{d}/../resources-service/postgres_service.py")
svc_mod = load_module("resources-service_fn", f"{d}/../resources-service/function.py")

def test_no_auth():
    with patch.object(svc_mod, "init_db"):
        assert svc_mod.handler(ev("GET", "/resources"))["statusCode"] == 401

def test_options():
    with patch.object(svc_mod, "init_db"):
        assert svc_mod.handler(ev("OPTIONS", "/resources"))["statusCode"] == 200

def test_post_missing_fields():
    with patch.object(svc_mod, "init_db"):
        r = svc_mod.handler(ev("POST", "/resources", {"name": "Alice"}, tok()))
        assert r["statusCode"] == 400

def test_allocation_post_missing_fields():
    with patch.object(svc_mod, "init_db"):
        r = svc_mod.handler(ev("POST", "/allocations", {"resource_id": "r1"}, tok()))
        assert r["statusCode"] == 400

def test_viewer_cannot_delete_resource():
    with patch.object(svc_mod, "init_db"):
        r = svc_mod.handler(ev("DELETE", "/resources/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", token=tok("viewer")))
        assert r["statusCode"] == 403

def test_contributor_cannot_delete_allocation():
    with patch.object(svc_mod, "init_db"):
        r = svc_mod.handler(ev("DELETE", "/allocations/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", token=tok("contributor")))
        assert r["statusCode"] == 403

def test_cors_headers():
    with patch.object(svc_mod, "init_db"):
        assert "Access-Control-Allow-Origin" in svc_mod.handler(ev("OPTIONS", "/resources"))["headers"]
