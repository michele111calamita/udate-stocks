import io

SHOPIFY_CSV = b"Handle,Variant SKU,Variant Inventory Qty\nprod1,SKU001,5\n"

def _upload_template(client, token):
    client.post(
        "/api/shopify-template",
        files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )

def test_get_mapping_no_template_returns_404(client, user_token):
    r = client.get("/api/mapping", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 404

def test_get_mapping_empty_before_sync(client, user_token):
    _upload_template(client, user_token)
    r = client.get("/api/mapping", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["mappings"] == {}
    assert data["maestro_columns"] == []
    assert "Variant SKU" in data["shopify_columns"]

def test_put_mapping_saves_and_returns(client, user_token):
    _upload_template(client, user_token)
    payload = {"mappings": {"Variant SKU": "codice", "Variant Inventory Qty": "giacenza"}}
    r = client.put("/api/mapping", json=payload, headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200

    r2 = client.get("/api/mapping", headers={"Authorization": f"Bearer {user_token}"})
    assert r2.json()["mappings"] == payload["mappings"]

def test_put_mapping_requires_auth(client):
    r = client.put("/api/mapping", json={"mappings": {}})
    assert r.status_code == 403

def test_get_mapping_requires_auth(client):
    r = client.get("/api/mapping")
    assert r.status_code == 403
