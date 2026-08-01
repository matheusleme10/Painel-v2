import json
from pathlib import Path


def test_vercel_routes_forward_protected_api_to_python():
    root = Path(__file__).resolve().parent.parent
    config = json.loads((root / "vercel.json").read_text(encoding="utf-8"))
    routes = {rewrite["source"]: rewrite["destination"] for rewrite in config["rewrites"]}

    assert routes["/api/access/(.*)"] == "/api/index"
    assert routes["/api/access-logs"] == "/api/index"
    assert routes["/api/access-settings"] == "/api/index"
    assert routes["/api/potential/(.*)"] == "/api/index"
