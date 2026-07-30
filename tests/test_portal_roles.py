from fastapi.testclient import TestClient
import hashlib

import backend.main as main_module
from backend.main import LOGIN_ATTEMPTS, app, redact_paused_revenue


def test_franchise_payload_keeps_active_prices_and_redacts_paused_prices():
    payload = {
        "rows": [
            {
                "status": "Pausado",
                "preco": "25.00",
                "precoNum": 25,
                "catalogRows": [
                    {"status": "Ativo", "preco": "30.00", "precoNum": 30},
                    {"status": "Pausado", "preco": "40.00", "precoNum": 40},
                ],
                "catalogHistory": [
                    {"status": "Ativo", "preco": "30.00", "precoNum": 30},
                    {"status": "Pausado", "preco": "40.00", "precoNum": 40},
                ],
                "productHistory": [
                    {"status": "Ativo", "preco": "30.00", "precoNum": 30},
                    {"status": "Pausado", "preco": "40.00", "precoNum": 40},
                ],
                "catalogCube": {
                    "records": [
                        [0, 0, 0, 0, 0, 0, 30],
                        [0, 1, 0, 0, 0, 1, 40],
                    ]
                },
            }
        ]
    }

    safe = redact_paused_revenue(payload)

    assert safe["rows"][0]["precoNum"] == 0
    assert safe["rows"][0]["catalogRows"][0]["precoNum"] == 30
    assert safe["rows"][0]["catalogRows"][1]["precoNum"] == 0
    assert safe["rows"][0]["catalogHistory"][0]["precoNum"] == 30
    assert safe["rows"][0]["catalogHistory"][1]["precoNum"] == 0
    assert safe["rows"][0]["productHistory"][0]["precoNum"] == 30
    assert safe["rows"][0]["productHistory"][1]["precoNum"] == 0
    assert safe["rows"][0]["catalogCube"]["records"][0][6] == 30
    assert safe["rows"][0]["catalogCube"]["records"][1][6] == 0
    assert payload["rows"][0]["precoNum"] == 25


def test_session_cookie_authenticates_without_exposing_hash_to_frontend(monkeypatch):
    admin_password = "senha-de-teste-admin"
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", hashlib.sha256(admin_password.encode()).hexdigest())
    monkeypatch.setenv("FRANCHISE_PASSWORD_HASH", hashlib.sha256(b"senha-franqueado").hexdigest())
    monkeypatch.setenv("SESSION_SECRET", "segredo-de-sessao-com-mais-de-trinta-e-dois-caracteres")

    with TestClient(app) as client:
        login = client.post("/api/session", json={"password": admin_password})
        assert login.status_code == 200
        assert login.json()["role"] == "admin"
        assert "HttpOnly" in login.headers["set-cookie"]

        session = client.get("/api/session")
        assert session.status_code == 200
        assert session.json() == {"authenticated": True, "role": "admin"}


def test_login_rate_limit_and_security_headers(monkeypatch):
    LOGIN_ATTEMPTS.clear()
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", hashlib.sha256(b"senha-correta").hexdigest())
    monkeypatch.setenv("FRANCHISE_PASSWORD_HASH", hashlib.sha256(b"outra-senha").hexdigest())
    monkeypatch.setenv("SESSION_SECRET", "segredo-de-sessao-com-mais-de-trinta-e-dois-caracteres")

    with TestClient(app) as client:
        for _ in range(5):
            response = client.post("/api/session", json={"password": "senha-errada"})
            assert response.status_code == 401

        blocked = client.post("/api/session", json={"password": "senha-correta"})
        assert blocked.status_code == 429
        assert blocked.headers["retry-after"] == "900"
        assert blocked.headers["x-frame-options"] == "DENY"
        assert blocked.headers["x-content-type-options"] == "nosniff"
        assert "frame-ancestors 'none'" in blocked.headers["content-security-policy"]


def test_notification_status_requires_admin_and_never_exposes_provider_tokens(monkeypatch):
    LOGIN_ATTEMPTS.clear()
    admin_password = "admin-notification-test"
    franchise_password = "franchise-notification-test"
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", hashlib.sha256(admin_password.encode()).hexdigest())
    monkeypatch.setenv("FRANCHISE_PASSWORD_HASH", hashlib.sha256(franchise_password.encode()).hexdigest())
    monkeypatch.setenv("SESSION_SECRET", "segredo-de-sessao-com-mais-de-trinta-e-dois-caracteres")
    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "token-que-nao-pode-sair")
    monkeypatch.setenv("SMTP_PASSWORD", "senha-que-nao-pode-sair")

    with TestClient(app) as franchise:
        franchise.post("/api/session", json={"password": franchise_password})
        assert franchise.get("/api/notifications/status").status_code == 403

    with TestClient(app) as admin:
        admin.post("/api/session", json={"password": admin_password})
        response = admin.get("/api/notifications/status")
        assert response.status_code == 200
        serialized = response.text
        assert "token-que-nao-pode-sair" not in serialized
        assert "senha-que-nao-pode-sair" not in serialized


def test_admin_can_persist_notification_toggle_and_many_recipients(monkeypatch, tmp_path):
    LOGIN_ATTEMPTS.clear()
    admin_password = "admin-settings-test"
    franchise_password = "franchise-settings-test"
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", hashlib.sha256(admin_password.encode()).hexdigest())
    monkeypatch.setenv("FRANCHISE_PASSWORD_HASH", hashlib.sha256(franchise_password.encode()).hexdigest())
    monkeypatch.setenv("SESSION_SECRET", "segredo-de-sessao-com-mais-de-trinta-e-dois-caracteres")
    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    monkeypatch.delenv("NOTIFY_EMAIL_TO", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("SMTP_USER", raising=False)
    monkeypatch.delenv("SMTP_PASSWORD", raising=False)
    monkeypatch.setattr(main_module, "NOTIFICATION_SETTINGS_PATH", tmp_path / "notification-settings.json")

    with TestClient(app) as franchise:
        franchise.post("/api/session", json={"password": franchise_password})
        denied = franchise.put("/api/notifications/settings", json={
            "autoEnabled": True,
            "emailRecipients": ["franqueado@italinhouse.com.br"],
        })
        assert denied.status_code == 403

    with TestClient(app) as admin:
        admin.post("/api/session", json={"password": admin_password})
        saved = admin.put("/api/notifications/settings", json={
            "autoEnabled": True,
            "senderEmail": "avisos@italinhouse.com.br",
            "senderName": "Ital in House",
            "emailRecipients": [
                "LOJA1@italinhouse.com.br",
                "loja2@italinhouse.com.br",
                "loja1@italinhouse.com.br",
            ],
        })
        assert saved.status_code == 200
        assert saved.json()["autoEnabled"] is True
        assert saved.json()["senderEmail"] == "avisos@italinhouse.com.br"
        assert saved.json()["emailRecipients"] == [
            "loja1@italinhouse.com.br",
            "loja2@italinhouse.com.br",
        ]

        status = admin.get("/api/notifications/status")
        assert status.status_code == 200
        assert status.json()["autoEnabled"] is True
        assert status.json()["emailRecipients"] == saved.json()["emailRecipients"]

        invalid = admin.put("/api/notifications/settings", json={
            "autoEnabled": False,
            "emailRecipients": ["email-invalido"],
        })
        assert invalid.status_code == 400

        invalid_sender = admin.put("/api/notifications/settings", json={
            "autoEnabled": False,
            "senderEmail": "remetente-invalido",
            "emailRecipients": [],
        })
        assert invalid_sender.status_code == 400

        smtp_missing = admin.post("/api/notifications/test", json={
            "recipient": "teste@italinhouse.com.br",
        })
        assert smtp_missing.status_code == 503
        assert "SMTP_HOST" in smtp_missing.json()["detail"]
