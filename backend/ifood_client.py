from __future__ import annotations

import asyncio
import os
import time
from dataclasses import dataclass
from typing import Any

import httpx

BASE_URL = "https://merchant-api.ifood.com.br"
TOKEN_PATH = "/authentication/v1.0/oauth/token"
TOKEN_SAFETY_WINDOW_SECONDS = 60


class IFoodAPIError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(slots=True)
class Token:
    access_token: str
    expires_in: int
    expires_at: float


class IFoodClient:
    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        *,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.client_id = (client_id or os.getenv("IFOOD_CLIENT_ID", "")).strip()
        self.client_secret = (client_secret or os.getenv("IFOOD_CLIENT_SECRET", "")).strip()
        self.auth_mode = os.getenv("IFOOD_AUTH_MODE", "oauth").strip().lower()
        manual = os.getenv("IFOOD_TOKEN", "").strip()
        self.manual_token = manual[7:].strip() if manual.lower().startswith("bearer ") else manual
        self._http_client = http_client
        self._token: Token | None = None
        self._token_lock = asyncio.Lock()

    def _require_credentials(self) -> None:
        if not self.client_id or not self.client_secret:
            raise IFoodAPIError("Credenciais iFood não configuradas no servidor.", 503)

    def _sanitize(self, message: Any) -> str:
        safe = str(message or "Falha não identificada no iFood.")
        for secret in (self.client_id, self.client_secret):
            if secret:
                safe = safe.replace(secret, "[credencial protegida]")
        if "no permissions granted to client" in safe.lower():
            return (
                "O aplicativo iFood não possui permissões habilitadas. "
                "Libere os módulos Merchant e Catalog no Portal do Desenvolvedor."
            )
        return safe[:300]

    @staticmethod
    def _message(payload: Any, fallback: str) -> str:
        if isinstance(payload, str):
            return payload
        if isinstance(payload, dict):
            value = (
                payload.get("error_description")
                or payload.get("errorDescription")
                or payload.get("message")
                or payload.get("error")
            )
            if isinstance(value, dict):
                return str(value.get("message") or value.get("description") or value)
            if value:
                return str(value)
        return fallback

    async def _request_raw(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        if self._http_client is not None:
            return await self._http_client.request(method, f"{BASE_URL}{path}", **kwargs)
        async with httpx.AsyncClient(timeout=30.0) as client:
            return await client.request(method, f"{BASE_URL}{path}", **kwargs)

    async def get_access_token(self, *, force_refresh: bool = False) -> tuple[Token, str]:
        if self.auth_mode == "manual":
            if not self.manual_token:
                raise IFoodAPIError("IFOOD_AUTH_MODE=manual, mas IFOOD_TOKEN está vazio.", 503)
            return Token(self.manual_token, 86400, time.time() + 86400), "manual"
        self._require_credentials()
        now = time.time()
        if not force_refresh and self._token and self._token.expires_at - TOKEN_SAFETY_WINDOW_SECONDS > now:
            return self._token, "cache"

        async with self._token_lock:
            now = time.time()
            if not force_refresh and self._token and self._token.expires_at - TOKEN_SAFETY_WINDOW_SECONDS > now:
                return self._token, "cache"

            response = await self._request_raw(
                "POST",
                TOKEN_PATH,
                headers={"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"},
                data={"grantType": "client_credentials", "clientId": self.client_id, "clientSecret": self.client_secret},
            )
            payload = self._json(response)
            if not response.is_success:
                self._token = None
                message = self._message(payload, "O iFood recusou as credenciais.")
                status = (
                    401
                    if response.status_code == 401
                    else 403
                    if response.status_code == 403
                    else 502
                )
                raise IFoodAPIError(self._sanitize(message), status)

            access_token = payload.get("accessToken") or payload.get("access_token")
            expires_in = int(payload.get("expiresIn") or payload.get("expires_in") or 3600)
            if not access_token:
                raise IFoodAPIError("O iFood não retornou um accessToken válido.", 502)

            self._token = Token(access_token, expires_in, now + expires_in)
            return self._token, "ifood"

    async def request(self, method: str, path: str, **kwargs: Any) -> Any:
        token, _ = await self.get_access_token()
        response = await self._authorized_request(token, method, path, **kwargs)
        if response.status_code == 401:
            token, _ = await self.get_access_token(force_refresh=True)
            response = await self._authorized_request(token, method, path, **kwargs)

        payload = self._json(response)
        if not response.is_success:
            message = self._message(payload, f"Falha no iFood ({response.status_code}).")
            raise IFoodAPIError(self._sanitize(message), response.status_code)
        return payload

    async def _authorized_request(self, token: Token, method: str, path: str, **kwargs: Any) -> httpx.Response:
        headers = {
            "Accept": "application/json",
            **kwargs.pop("headers", {}),
            "Authorization": f"Bearer {token.access_token}",
        }
        return await self._request_raw(method, path, headers=headers, **kwargs)

    @staticmethod
    def _json(response: httpx.Response) -> Any:
        if not response.content:
            return {}
        try:
            return response.json()
        except ValueError:
            return response.text

    async def list_merchants(self) -> list[dict[str, str]]:
        payload = await self.request("GET", "/merchant/v1.0/merchants?size=100")
        merchants = payload if isinstance(payload, list) else payload.get("merchants") or payload.get("content") or []
        return [
            {
                "id": merchant["id"],
                "name": merchant.get("name") or merchant.get("corporateName") or "Loja sem nome",
                "corporateName": merchant.get("corporateName", ""),
            }
            for merchant in merchants
            if merchant.get("id")
        ]

    async def list_categories(self, merchant_id: str) -> list[dict[str, Any]]:
        payload = await self.request(
            "GET", f"/catalog/v2.0/merchants/{merchant_id}/categories?include_items=true"
        )
        return payload if isinstance(payload, list) else payload.get("categories", [])
