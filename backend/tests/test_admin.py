def test_create_user(client, admin_token):
    r = client.post(
        "/admin/users",
        json={"email": "new@test.com", "password": "pass123"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    assert r.json()["email"] == "new@test.com"
    assert r.json()["is_admin"] is False

def test_create_admin_user(client, admin_token):
    r = client.post(
        "/admin/users",
        json={"email": "newadmin@test.com", "password": "pass", "is_admin": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    assert r.json()["is_admin"] is True

def test_create_user_duplicate_email(client, admin_token, admin_user):
    r = client.post(
        "/admin/users",
        json={"email": "admin@test.com", "password": "x"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 409

def test_create_user_requires_admin(client, user_token):
    r = client.post(
        "/admin/users",
        json={"email": "x@test.com", "password": "x"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 403

def test_list_users(client, admin_token, admin_user, regular_user):
    r = client.get("/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert len(r.json()) == 2
