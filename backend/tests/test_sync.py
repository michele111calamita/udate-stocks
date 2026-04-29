import io
import pandas as pd

SHOPIFY_CSV = b"Handle,Variant SKU,Variant Inventory Qty\nprod1,SKU001,5\nprod2,SKU002,3\n"
MAESTRO_CSV = b"codice,giacenza\nSKU001,42\nSKU003,99\n"

def _upload_template(client, token):
    client.post(
        "/api/shopify-template",
        files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )

def test_sync_updates_quantities(client, user_token):
    _upload_template(client, user_token)
    r = client.post(
        "/api/sync",
        files={"file": ("maestro.csv", io.BytesIO(MAESTRO_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["format"] == "csv"
    assert data["maestro_sku_col"] == "codice"
    matched_skus = {m["sku"] for m in data["matched"]}
    assert "SKU001" in matched_skus
    assert data["unmatched"] == ["SKU002"]
    assert len(data["maestro_rows"]) == 2
    sku001_row = next(row for row in data["maestro_rows"] if row["codice"] == "SKU001")
    assert sku001_row["giacenza"] == "42"

def test_sync_saves_maestro_columns(client, user_token):
    _upload_template(client, user_token)
    client.post(
        "/api/sync",
        files={"file": ("maestro.csv", io.BytesIO(MAESTRO_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    r = client.get("/api/mapping", headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code == 200
    assert set(r.json()["maestro_columns"]) == {"codice", "giacenza"}

def test_sync_no_template(client, user_token):
    r = client.post(
        "/api/sync",
        files={"file": ("maestro.csv", io.BytesIO(MAESTRO_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 404

def test_sync_maestro_missing_sku_column(client, user_token):
    _upload_template(client, user_token)
    bad_maestro = b"nome,quantita_magazzino\nProdotto1,10\n"
    r = client.post(
        "/api/sync",
        files={"file": ("maestro.csv", io.BytesIO(bad_maestro), "text/csv")},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 422

def test_sync_requires_auth(client):
    r = client.post(
        "/api/sync",
        files={"file": ("maestro.csv", io.BytesIO(MAESTRO_CSV), "text/csv")},
    )
    assert r.status_code == 403
