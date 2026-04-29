import io
import base64
import pandas as pd

SHOPIFY_CSV = b"Handle,Variant SKU,Variant Inventory Qty\nprod1,SKU001,5\n"
MAESTRO_CSV = b"codice,giacenza\nSKU001,42\nSKU999,10\n"

def _upload_template(client, token):
    client.post(
        "/api/shopify-template",
        files={"file": ("shopify.csv", io.BytesIO(SHOPIFY_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )

def _do_sync(client, token):
    r = client.post(
        "/api/sync",
        files={"file": ("maestro.csv", io.BytesIO(MAESTRO_CSV), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )
    return r.json()

def _save_mapping(client, token):
    client.put(
        "/api/mapping",
        json={"mappings": {"Variant SKU": "codice", "Variant Inventory Qty": "giacenza"}},
        headers={"Authorization": f"Bearer {token}"},
    )

def test_add_products_appends_rows(client, user_token):
    _upload_template(client, user_token)
    sync_data = _do_sync(client, user_token)
    _save_mapping(client, user_token)

    selected = [{"codice": "SKU999", "giacenza": "10"}]
    r = client.post(
        "/api/sync/add-products",
        json={
            "file_b64": sync_data["file_b64"],
            "format": "csv",
            "selected_rows": selected,
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "file_b64" in data
    assert data["filename"] == "shopify_with_additions.csv"

    decoded = base64.b64decode(data["file_b64"])
    df = pd.read_csv(io.BytesIO(decoded), dtype=str)
    assert "SKU999" in df["Variant SKU"].values
    assert df[df["Variant SKU"] == "SKU999"]["Variant Inventory Qty"].values[0] == "10"

def test_add_products_no_mapping_returns_422(client, user_token):
    _upload_template(client, user_token)
    sync_data = _do_sync(client, user_token)

    r = client.post(
        "/api/sync/add-products",
        json={
            "file_b64": sync_data["file_b64"],
            "format": "csv",
            "selected_rows": [{"codice": "SKU999"}],
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 422

def test_add_products_requires_auth(client):
    r = client.post(
        "/api/sync/add-products",
        json={"file_b64": "x", "format": "csv", "selected_rows": []},
    )
    assert r.status_code == 403
