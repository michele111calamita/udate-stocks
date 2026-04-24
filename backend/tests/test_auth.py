def test_login_success(client, admin_user):
    r = client.post("/auth/login", json={"email": "admin@test.com", "password": "secret"})
    assert r.status_code == 200
    assert "access_token" in r.json()

def test_login_wrong_password(client, admin_user):
    r = client.post("/auth/login", json={"email": "admin@test.com", "password": "wrong"})
    assert r.status_code == 401

def test_login_unknown_email(client):
    r = client.post("/auth/login", json={"email": "nobody@test.com", "password": "x"})
    assert r.status_code == 401
