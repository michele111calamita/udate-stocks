import io

SHOPIFY_CSV = b"Handle,Variant SKU,Variant Inventory Qty\nprod1,SKU001,10\n"

def test_upload_template_csv(client, user_token):
    r = client.post(
        "/api/shopify-template",
        files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["filename"] == "shopify.csv"
    assert data["sku_column"] == "Variant SKU"
    assert data["qty_column"] == "Variant Inventory Qty"

def test_upload_template_replaces_existing(client, user_token):
    for _ in range(2):
        client.post(
            "/api/shopify-template",
            files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
            headers={"Authorization": f"Bearer {user_token}"},
        )
    r = client.get("/api/shopify-template", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200  # only one template

def test_get_template_not_found(client, user_token):
    r = client.get("/api/shopify-template", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 404

def test_get_template_after_upload(client, user_token):
    client.post(
        "/api/shopify-template",
        files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    r = client.get("/api/shopify-template", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200
    assert r.json()["filename"] == "shopify.csv"

def test_upload_unsupported_format(client, user_token):
    r = client.post(
        "/api/shopify-template",
        files={"file": ("file.txt", io.BytesIO(b"hello"), "text/plain")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 400

def test_upload_requires_auth(client):
    r = client.post(
        "/api/shopify-template",
        files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
    )
    assert r.status_code == 403
