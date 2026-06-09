"""
Unit and integration tests for auth-service.
"""
import json, sys, os, pytest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../auth-service'))
from function import handler, hash_password, verify_password, generate_token, verify_token

# --- Pure unit tests (no DB needed) ---

def test_hash_and_verify_password():
    h = hash_password("mysecret")
    assert verify_password("mysecret", h)
    assert not verify_password("wrongpassword", h)

def test_hash_is_different_each_time():
    assert hash_password("same") != hash_password("same")

def test_generate_and_verify_token():
    user = {"id": "abc-123", "email": "test@test.com", "role": "admin"}
    token = generate_token(user)
    payload = verify_token(token)
    assert payload["sub"] == "abc-123"
    assert payload["email"] == "test@test.com"
    assert payload["role"] == "admin"

def test_verify_invalid_token():
    assert verify_token("not.a.token") is None

def test_verify_tampered_token():
    user = {"id": "abc-123", "email": "test@test.com", "role": "admin"}
    token = generate_token(user)
    assert verify_token(token + "tampered") is None

# --- Handler tests (DB mocked) ---

def ev(method, path, body=None, token=None):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    return {"httpMethod": method, "path": path, "headers": h,
            "body": json.dumps(body) if body else None, "queryStringParameters": {}}

@patch("function.init_db")
def test_options_preflight(mock_db):
    result = handler(ev("OPTIONS", "/register"))
    assert result["statusCode"] == 200

@patch("function.init_db")
def test_verify_no_token(mock_db):
    result = handler(ev("POST", "/verify"))
    assert result["statusCode"] == 401

@patch("function.init_db")
def test_users_no_token(mock_db):
    result = handler(ev("GET", "/users"))
    assert result["statusCode"] == 401

@patch("function.init_db")
def test_unknown_endpoint(mock_db):
    result = handler(ev("GET", "/unknown"))
    assert result["statusCode"] == 404

@patch("function.init_db")
def test_register_missing_fields(mock_db):
    result = handler(ev("POST", "/register", {"email": "a@b.com"}))
    assert result["statusCode"] == 400

@patch("function.init_db")
def test_login_missing_fields(mock_db):
    result = handler(ev("POST", "/login", {"email": "a@b.com"}))
    assert result["statusCode"] == 400

@patch("function.init_db")
def test_cors_headers(mock_db):
    result = handler(ev("OPTIONS", "/login"))
    assert result["headers"]["Access-Control-Allow-Origin"] == "*"
