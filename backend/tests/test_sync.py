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
    assert r.headers["X-Unmatched-SKUs"] == "1"  # SKU002 non in Maestro
    df = pd.read_csv(io.BytesIO(r.content), dtype=str)
    assert df[df["Variant SKU"] == "SKU001"]["Variant Inventory Qty"].values[0] == "42"
    assert df[df["Variant SKU"] == "SKU002"]["Variant Inventory Qty"].values[0] == "3"

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
