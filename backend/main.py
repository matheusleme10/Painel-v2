from __future__ import annotations

import os
import re
import gzip
import json
import shutil
import secrets
import hmac
import hashlib
import base64
import time
import asyncio
import smtplib
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .catalog import items_to_csv, normalize_categories
from .ifood_client import IFoodAPIError, IFoodClient

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
DATA_DIR = ROOT / "data"
STAGING_DIR = DATA_DIR / "staging"
CURRENT_DATA = DATA_DIR / "current.json.gz"
BLOB_PATH = "ital-dashboard/current.json.gz"
NOTIFICATION_SETTINGS_PATH = DATA_DIR / "notification-settings.json"
NOTIFICATION_SETTINGS_BLOB_PATH = "ital-dashboard/notification-settings.json"
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.local", override=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ifood = IFoodClient()
    yield


app = FastAPI(
    title="Ital in House Dashboard API",
    docs_url="/api/docs" if os.getenv("NODE_ENV") != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)
origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; "
        "base-uri 'self'; form-action 'self'"
    )
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


class SyncRequest(BaseModel):
    merchantId: str


class DataAction(BaseModel):
    action: str
    uploadId: str | None = None
    chunkIndex: int | None = None
    rows: list[dict] | None = None
    totalRows: int | None = None
    uploadedAt: str | None = None


class LoginRequest(BaseModel):
    password: str


class NotificationRequest(BaseModel):
    message: str | None = None
    subject: str | None = None


class NotificationSettingsRequest(BaseModel):
    autoEnabled: bool
    emailRecipients: list[str] = Field(default_factory=list)
    senderEmail: str = ""
    senderName: str = "Ital in House"


class NotificationTestRequest(BaseModel):
    recipient: str


def client() -> IFoodClient:
    return app.state.ifood


def api_error(error: IFoodAPIError) -> HTTPException:
    return HTTPException(status_code=error.status_code, detail=str(error))


SESSION_COOKIE = "ital_portal_session"
SESSION_TTL_SECONDS = 8 * 60 * 60
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_MAX_ATTEMPTS = 5
LOGIN_ATTEMPTS: dict[str, list[float]] = {}
LAST_NOTIFICATION: dict = {"status": "never", "sentAt": None, "emailCount": 0, "whatsappCount": 0}
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _session_secret() -> bytes:
    secret = os.getenv("SESSION_SECRET", "").strip()
    if len(secret) < 32:
        raise HTTPException(status_code=503, detail="Sessão segura não configurada.")
    return secret.encode("utf-8")


def _password_role(password: str) -> str | None:
    supplied = hashlib.sha256(password.strip().encode("utf-8")).hexdigest()
    admin_hash = os.getenv("ADMIN_PASSWORD_HASH", "").strip()
    franchise_hash = os.getenv("FRANCHISE_PASSWORD_HASH", "").strip()
    if admin_hash and hmac.compare_digest(supplied, admin_hash):
        return "admin"
    if franchise_hash and hmac.compare_digest(supplied, franchise_hash):
        return "franchise"
    return None


def _create_session(role: str) -> str:
    payload = f"{role}:{int(time.time()) + SESSION_TTL_SECONDS}"
    signature = hmac.new(_session_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{signature}".encode("utf-8")).decode("ascii")


def _login_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def _check_login_rate(request: Request) -> str:
    key = _login_key(request)
    cutoff = time.time() - LOGIN_WINDOW_SECONDS
    LOGIN_ATTEMPTS[key] = [attempt for attempt in LOGIN_ATTEMPTS.get(key, []) if attempt > cutoff]
    if len(LOGIN_ATTEMPTS[key]) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.",
            headers={"Retry-After": str(LOGIN_WINDOW_SECONDS)},
        )
    return key


def require_session(request: Request) -> str:
    token = request.cookies.get(SESSION_COOKIE, "")
    try:
        role, expires, signature = base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8").split(":")
        payload = f"{role}:{expires}"
        expected = hmac.new(_session_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if role not in {"admin", "franchise"} or int(expires) <= int(time.time()):
            raise ValueError
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        return role
    except (ValueError, TypeError, UnicodeError):
        raise HTTPException(status_code=401, detail="Não autorizado.")


def redact_paused_revenue(payload: dict) -> dict:
    def redact_row(row: dict) -> dict:
        safe = dict(row)
        if safe.get("status") == "Pausado":
            safe["preco"] = ""
            safe["precoNum"] = 0
        if isinstance(safe.get("catalogRows"), list):
            safe["catalogRows"] = [redact_row(entry) for entry in safe["catalogRows"]]
        if isinstance(safe.get("catalogHistory"), list):
            safe["catalogHistory"] = [redact_row(entry) for entry in safe["catalogHistory"]]
        if isinstance(safe.get("productHistory"), list):
            safe["productHistory"] = [redact_row(entry) for entry in safe["productHistory"]]
        cube = safe.get("catalogCube")
        if isinstance(cube, dict) and isinstance(cube.get("records"), list):
            for record in cube["records"]:
                if isinstance(record, list) and len(record) >= 7 and record[5] == 1:
                    record[6] = 0
        return safe

    safe_payload = dict(payload)
    safe_payload["rows"] = [redact_row(row) for row in payload.get("rows", [])]
    return safe_payload


async def read_current_payload() -> dict | None:
    if os.getenv("BLOB_READ_WRITE_TOKEN", "").strip():
        from vercel.blob import AsyncBlobClient

        async with AsyncBlobClient() as blob_client:
            result = await blob_client.get(BLOB_PATH, access="private")
            if result is None or result.status_code != 200 or result.stream is None:
                return None
            compressed = b"".join([chunk async for chunk in result.stream])
        return json.loads(gzip.decompress(compressed).decode("utf-8"))

    if not CURRENT_DATA.is_file():
        return None
    with gzip.open(CURRENT_DATA, "rt", encoding="utf-8") as source:
        return json.load(source)


async def write_current_payload(payload: dict) -> None:
    compressed = gzip.compress(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        compresslevel=9,
    )
    if os.getenv("BLOB_READ_WRITE_TOKEN", "").strip():
        from vercel.blob import AsyncBlobClient

        async with AsyncBlobClient() as blob_client:
            await blob_client.put(
                BLOB_PATH,
                compressed,
                access="private",
                content_type="application/gzip",
                overwrite=True,
                cache_control_max_age=60,
            )
        return

    DATA_DIR.mkdir(exist_ok=True)
    temporary = DATA_DIR / "current.next.json.gz"
    temporary.write_bytes(compressed)
    temporary.replace(CURRENT_DATA)


def _default_notification_settings() -> dict:
    recipients = [
        value.strip().lower()
        for value in os.getenv("NOTIFY_EMAIL_TO", "").split(",")
        if value.strip()
    ]
    return {
        "autoEnabled": os.getenv("AUTO_NOTIFY_ON_UPLOAD", "").strip().lower() in {"1", "true", "yes", "sim"},
        "emailRecipients": list(dict.fromkeys(recipients)),
        "senderEmail": os.getenv("SMTP_FROM", "").strip().lower(),
        "senderName": "Ital in House",
    }


async def read_notification_settings() -> dict:
    defaults = _default_notification_settings()
    if os.getenv("BLOB_READ_WRITE_TOKEN", "").strip():
        from vercel.blob import AsyncBlobClient

        async with AsyncBlobClient() as blob_client:
            result = await blob_client.get(NOTIFICATION_SETTINGS_BLOB_PATH, access="private")
            if result is None or result.status_code != 200 or result.stream is None:
                return defaults
            raw = b"".join([chunk async for chunk in result.stream])
        saved = json.loads(raw.decode("utf-8"))
        return {**defaults, **saved}

    if not NOTIFICATION_SETTINGS_PATH.is_file():
        return defaults
    return {**defaults, **json.loads(NOTIFICATION_SETTINGS_PATH.read_text(encoding="utf-8"))}


async def write_notification_settings(settings: dict) -> None:
    serialized = json.dumps(settings, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if os.getenv("BLOB_READ_WRITE_TOKEN", "").strip():
        from vercel.blob import AsyncBlobClient

        async with AsyncBlobClient() as blob_client:
            await blob_client.put(
                NOTIFICATION_SETTINGS_BLOB_PATH,
                serialized,
                access="private",
                content_type="application/json",
                overwrite=True,
                cache_control_max_age=0,
            )
        return

    DATA_DIR.mkdir(exist_ok=True)
    temporary = DATA_DIR / "notification-settings.next.json"
    temporary.write_bytes(serialized)
    temporary.replace(NOTIFICATION_SETTINGS_PATH)


def _notification_context(payload: dict) -> dict[str, str]:
    rows = payload.get("rows") or []
    metadata = next((row for row in rows if row.get("networkHistory") or row.get("networkSummary")), {})
    dates = [
        *(entry.get("date") for entry in metadata.get("networkHistory", [])),
        *(row.get("dia") for row in rows),
    ]
    date = max((str(value)[:10] for value in dates if value), default=datetime.now().date().isoformat())
    now = datetime.now(ZoneInfo("America/Sao_Paulo"))
    shift = "Almoço" if now.hour < 17 else "Jantar"
    greeting = "Boa tarde" if shift == "Almoço" else "Boa noite"
    formatted_date = datetime.fromisoformat(date).strftime("%d/%m/%Y")
    dashboard_url = os.getenv("DASHBOARD_PUBLIC_URL", "").strip()
    default_message = (
        f"{greeting}! O Dashboard de Itens Pausados foi atualizado com os dados de "
        f"{shift}, {formatted_date}.\n\n"
        "Acesse o portal para consultar itens ativos, pausados e o ranking da rede."
    )
    if dashboard_url:
        default_message += f"\n\n{dashboard_url}"
    return {
        "date": date,
        "formattedDate": formatted_date,
        "shift": shift,
        "greeting": greeting,
        "message": default_message,
        "subject": f"Dashboard atualizado – {shift} – {formatted_date}",
    }


def _send_emails(subject: str, body: str, recipients: list[str], sender_email: str, sender_name: str) -> int:
    if not recipients:
        return 0
    required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]
    if not all(os.getenv(key, "").strip() for key in required):
        raise RuntimeError(
            "Servidor de e-mail não configurado. Preencha SMTP_HOST, SMTP_USER e SMTP_PASSWORD "
            "nas variáveis de ambiente."
        )
    if not sender_email:
        raise RuntimeError("Informe o e-mail remetente na página Avisos.")
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{sender_name} <{sender_email}>" if sender_name else sender_email
    message["To"] = sender_email
    message["Bcc"] = ", ".join(recipients)
    message.set_content(body)
    port = int(os.getenv("SMTP_PORT", "465"))
    security = os.getenv("SMTP_SECURITY", "ssl" if port == 465 else "starttls").strip().lower()
    if security == "starttls":
        with smtplib.SMTP(os.environ["SMTP_HOST"], port, timeout=20) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
            smtp.send_message(message)
    else:
        with smtplib.SMTP_SSL(os.environ["SMTP_HOST"], port, timeout=20) as smtp:
            smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
            smtp.send_message(message)
    return len(recipients)


async def _send_whatsapp(body: str) -> int:
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "").strip()
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    recipients = [value.strip() for value in os.getenv("WHATSAPP_TO", "").split(",") if value.strip()]
    if not recipients:
        return 0
    if not token or not phone_id:
        raise RuntimeError("WhatsApp Cloud API incompleta.")
    async with httpx.AsyncClient(timeout=20) as client:
        for recipient in recipients:
            response = await client.post(
                f"https://graph.facebook.com/v21.0/{phone_id}/messages",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "messaging_product": "whatsapp",
                    "to": recipient,
                    "type": "text",
                    "text": {"preview_url": False, "body": body},
                },
            )
            response.raise_for_status()
    return len(recipients)


async def send_notifications(payload: dict, message: str | None = None, subject: str | None = None) -> dict:
    context = _notification_context(payload)
    settings = await read_notification_settings()
    body = (message or context["message"]).strip()
    title = (subject or context["subject"]).strip()
    email_count, whatsapp_count = await asyncio.gather(
        asyncio.to_thread(
            _send_emails,
            title,
            body,
            settings["emailRecipients"],
            settings["senderEmail"],
            settings["senderName"],
        ),
        _send_whatsapp(body),
    )
    LAST_NOTIFICATION.update({
        "status": "sent",
        "sentAt": datetime.now(timezone.utc).isoformat(),
        "emailCount": email_count,
        "whatsappCount": whatsapp_count,
        **context,
    })
    return dict(LAST_NOTIFICATION)


async def maybe_send_notifications(payload: dict) -> dict:
    settings = await read_notification_settings()
    if not settings["autoEnabled"]:
        return {"status": "disabled"}
    try:
        return await send_notifications(payload)
    except (RuntimeError, OSError, smtplib.SMTPException, httpx.HTTPError) as error:
        LAST_NOTIFICATION.update({
            "status": "error",
            "sentAt": datetime.now(timezone.utc).isoformat(),
            "error": str(error),
        })
        return dict(LAST_NOTIFICATION)


@app.post("/api/session")
async def login_session(credentials: LoginRequest, request: Request, response: Response) -> dict:
    attempt_key = _check_login_rate(request)
    role = _password_role(credentials.password)
    if role is None:
        LOGIN_ATTEMPTS.setdefault(attempt_key, []).append(time.time())
        raise HTTPException(status_code=401, detail="Senha incorreta.")
    LOGIN_ATTEMPTS.pop(attempt_key, None)
    response.set_cookie(
        SESSION_COOKIE,
        _create_session(role),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=os.getenv("NODE_ENV") == "production" or bool(os.getenv("VERCEL")),
        samesite="strict",
        path="/",
    )
    return {"authenticated": True, "role": role}


@app.get("/api/session")
async def session_status(request: Request) -> dict:
    return {"authenticated": True, "role": require_session(request)}


@app.delete("/api/session")
async def logout_session(response: Response) -> dict:
    response.delete_cookie(SESSION_COOKIE, path="/", samesite="strict")
    return {"authenticated": False}


@app.get("/api/data")
async def load_saved_data(request: Request) -> dict:
    role = require_session(request)
    payload = await read_current_payload()
    if payload is None:
        return {"hasData": False, "rows": []}
    response = {"hasData": True, **payload}
    return redact_paused_revenue(response) if role == "franchise" else response


@app.post("/api/data/upload")
async def upload_compressed_data(request: Request) -> dict:
    if require_session(request) != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem atualizar a base.")
    compressed = await request.body()
    if not compressed or len(compressed) > 4_000_000:
        raise HTTPException(status_code=413, detail="Base comprimida excede o limite seguro de 4 MB.")
    try:
        payload = json.loads(gzip.decompress(compressed).decode("utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=400, detail="Arquivo de dados comprimido inválido.") from error
    rows = payload.get("rows")
    if not isinstance(rows, list) or len(rows) != payload.get("totalRows"):
        raise HTTPException(status_code=400, detail="Quantidade de registros inconsistente.")
    await write_current_payload(payload)
    notification = await maybe_send_notifications(payload)
    return {"success": True, "totalRows": len(rows), "notification": notification}


@app.post("/api/data")
async def save_data(action: DataAction, request: Request) -> dict:
    if require_session(request) != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem atualizar a base.")
    DATA_DIR.mkdir(exist_ok=True)
    STAGING_DIR.mkdir(exist_ok=True)

    if action.action == "start":
        upload_id = secrets.token_hex(12)
        (STAGING_DIR / upload_id).mkdir()
        return {"success": True, "uploadId": upload_id}

    if not action.uploadId or not re.fullmatch(r"[0-9a-f]{24}", action.uploadId):
        raise HTTPException(status_code=400, detail="Upload inválido.")
    upload_dir = STAGING_DIR / action.uploadId
    if not upload_dir.is_dir():
        raise HTTPException(status_code=404, detail="Upload não encontrado.")

    if action.action == "chunk":
        if action.chunkIndex is None or action.chunkIndex < 0 or action.rows is None:
            raise HTTPException(status_code=400, detail="Chunk inválido.")
        target = upload_dir / f"{action.chunkIndex:05d}.json.gz"
        with gzip.open(target, "wt", encoding="utf-8") as output:
            json.dump(action.rows, output, ensure_ascii=False, separators=(",", ":"))
        return {"success": True}

    if action.action == "complete":
        rows: list[dict] = []
        for chunk in sorted(upload_dir.glob("*.json.gz")):
            with gzip.open(chunk, "rt", encoding="utf-8") as source:
                rows.extend(json.load(source))
        if action.totalRows is not None and len(rows) != action.totalRows:
            raise HTTPException(status_code=400, detail="Quantidade de registros inconsistente.")
        payload = {"rows": rows, "totalRows": len(rows), "uploadedAt": action.uploadedAt}
        await write_current_payload(payload)
        notification = await maybe_send_notifications(payload)
        shutil.rmtree(upload_dir)
        return {"success": True, "notification": notification}

    raise HTTPException(status_code=400, detail="Ação inválida.")


@app.delete("/api/data")
async def clear_saved_data(request: Request) -> dict:
    if require_session(request) != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem limpar a base.")
    if os.getenv("BLOB_READ_WRITE_TOKEN", "").strip():
        from vercel.blob import AsyncBlobClient

        async with AsyncBlobClient() as blob_client:
            await blob_client.delete(BLOB_PATH)
    if CURRENT_DATA.exists():
        CURRENT_DATA.unlink()
    return {"success": True}


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "runtime": "python"}


@app.get("/api/notifications/status")
async def notification_status(request: Request) -> dict:
    if require_session(request) != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem consultar avisos.")
    payload = await read_current_payload() or {"rows": []}
    settings = await read_notification_settings()
    return {
        **LAST_NOTIFICATION,
        "autoEnabled": settings["autoEnabled"],
        "emailConfigured": bool(settings["emailRecipients"]),
        "emailRecipients": settings["emailRecipients"],
        "senderEmail": settings["senderEmail"],
        "senderName": settings["senderName"],
        "smtpConfigured": all(os.getenv(key, "").strip() for key in ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]),
        "whatsappConfigured": bool(os.getenv("WHATSAPP_TO", "").strip()),
        "preview": _notification_context(payload),
    }


@app.put("/api/notifications/settings")
async def notification_settings(action: NotificationSettingsRequest, request: Request) -> dict:
    if require_session(request) != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem configurar avisos.")
    recipients = list(dict.fromkeys(
        value.strip().lower()
        for value in action.emailRecipients
        if value.strip()
    ))
    if len(recipients) > 1000:
        raise HTTPException(status_code=400, detail="Limite de 1.000 destinatários por configuração.")
    invalid = [value for value in recipients if not EMAIL_PATTERN.fullmatch(value)]
    if invalid:
        raise HTTPException(status_code=400, detail=f"E-mail inválido: {invalid[0]}")
    sender_email = action.senderEmail.strip().lower()
    if sender_email and not EMAIL_PATTERN.fullmatch(sender_email):
        raise HTTPException(status_code=400, detail="E-mail remetente inválido.")
    sender_name = action.senderName.strip()[:80] or "Ital in House"
    settings = {
        "autoEnabled": action.autoEnabled,
        "emailRecipients": recipients,
        "senderEmail": sender_email,
        "senderName": sender_name,
    }
    await write_notification_settings(settings)
    return {
        "success": True,
        **settings,
        "emailConfigured": bool(recipients),
    }


@app.post("/api/notifications/test")
async def notification_test(action: NotificationTestRequest, request: Request) -> dict:
    if require_session(request) != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem testar avisos.")
    recipient = action.recipient.strip().lower()
    if not EMAIL_PATTERN.fullmatch(recipient):
        raise HTTPException(status_code=400, detail="Informe um destinatário de teste válido.")
    settings = await read_notification_settings()
    try:
        count = await asyncio.to_thread(
            _send_emails,
            "Teste de envio – Dashboard Ital in House",
            "Este é um e-mail de teste do Dashboard de Itens Pausados.\n\n"
            "Se você recebeu esta mensagem, a configuração de envio está funcionando.",
            [recipient],
            settings["senderEmail"],
            settings["senderName"],
        )
        return {"success": True, "emailCount": count, "recipient": recipient}
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except smtplib.SMTPAuthenticationError as error:
        raise HTTPException(status_code=502, detail="O servidor recusou o usuário ou a senha SMTP.") from error
    except (OSError, smtplib.SMTPException) as error:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível conectar ao servidor SMTP. Confira host, porta e tipo de segurança.",
        ) from error


@app.post("/api/notifications/send")
async def notification_send(action: NotificationRequest, request: Request) -> dict:
    if require_session(request) != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem enviar avisos.")
    payload = await read_current_payload()
    if payload is None:
        raise HTTPException(status_code=404, detail="Nenhuma base publicada.")
    try:
        return await send_notifications(payload, action.message, action.subject)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except (OSError, smtplib.SMTPException, httpx.HTTPError) as error:
        raise HTTPException(status_code=502, detail="Falha no provedor de envio.") from error


@app.get("/api/ifood/auth")
@app.post("/api/ifood/auth")
async def ifood_auth() -> dict:
    try:
        token, source = await client().get_access_token()
        merchants = await client().list_merchants()
        selected = os.getenv("IFOOD_TEST_MERCHANT_ID", "").strip()
        return {
            "success": True,
            "connected": True,
            "expiresIn": token.expires_in,
            "expiresAt": datetime.fromtimestamp(token.expires_at, tz=timezone.utc).isoformat(),
            "tokenSource": source,
            "authMode": client().auth_mode,
            "merchants": merchants,
            "selectedMerchantId": selected or (merchants[0]["id"] if merchants else None),
        }
    except IFoodAPIError as error:
        raise api_error(error) from error


@app.post("/api/ifood/sync")
async def ifood_sync(request: SyncRequest) -> dict:
    merchant_id = request.merchantId.strip()
    if not re.fullmatch(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",
        merchant_id,
        re.IGNORECASE,
    ):
        raise HTTPException(status_code=400, detail="Selecione uma loja iFood válida.")

    try:
        merchants = await client().list_merchants()
        merchant = next((entry for entry in merchants if entry["id"] == merchant_id), None)
        if merchant is None:
            raise HTTPException(status_code=403, detail="A credencial atual não possui acesso a essa loja.")

        categories = await client().list_categories(merchant_id)
        items = normalize_categories(categories, merchant["name"])
        paused = sum(item["status"] == "Pausado" for item in items)
        return {
            "success": True,
            "merchant": merchant,
            "totalItems": len(items),
            "activeItems": len(items) - paused,
            "pausedItems": paused,
            "categories": len(categories),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "csv": items_to_csv(items),
        }
    except IFoodAPIError as error:
        raise api_error(error) from error


@app.get("/{path:path}", include_in_schema=False)
async def frontend(path: str):
    requested = (DIST / path).resolve()
    if path and requested.is_relative_to(DIST.resolve()) and requested.is_file():
        return FileResponse(requested)
    index = DIST / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(status_code=503, detail="Frontend não compilado. Execute npm run build.")
