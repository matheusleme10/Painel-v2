from __future__ import annotations

import asyncio
import base64
import json
import mimetypes
import os
import time
from dataclasses import dataclass
from pathlib import Path
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
        return safe[:1500]

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
                value = value.get("message") or value.get("description") or value
            text = str(value) if value else fallback
            # A validação de bean do iFood (ex.: "FullItemDto is not valid") costuma
            # vir com uma lista de campos específicos que falharam — sem isso é
            # impossível saber qual campo corrigir. Anexa se existir.
            details = (
                payload.get("details")
                or payload.get("violations")
                or payload.get("errors")
                or payload.get("fieldErrors")
            )
            if details:
                text = f"{text} | detalhes: {json.dumps(details, ensure_ascii=False)[:1000]}"
            return text
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

    async def list_categories(
        self, merchant_id: str, catalog_id: str | None = None
    ) -> list[dict[str, Any]]:
        """`GET /categories` sem catalogId no path deu "no Route matched with
        those values" em teste real (mesmo problema do create_category) — a
        rota exige o catalogId. Busca automaticamente via list_catalogs se não
        for informado, pra não quebrar quem já chama list_categories(merchant_id)
        sem esse argumento."""
        if not catalog_id:
            catalogs = await self.list_catalogs(merchant_id)
            if not catalogs:
                return []
            catalog_id = catalogs[0]["catalogId"]
        payload = await self.request(
            "GET",
            f"/catalog/v2.0/merchants/{merchant_id}/catalogs/{catalog_id}/categories?include_items=true",
        )
        return payload if isinstance(payload, list) else payload.get("categories", [])

    # ------------------------------------------------------------------
    # Escrita — usada só nos cenários de homologação (Merchant + Catalog)
    # pedidos pelo suporte do iFood, gravados em vídeo. Não faz parte do
    # fluxo normal do dashboard, que é somente leitura (métodos acima).
    #
    # ATENÇÃO: os nomes de campo abaixo foram levantados na documentação
    # pública do iFood, mas a Catalog API é sensível a versão. Antes de
    # gravar de verdade, confira cada payload no "API Reference" do
    # Developer Portal (aba com Swagger/"Try it out") e ajuste se algum
    # nome de campo tiver mudado. Use --dry-run no script de homologação
    # pra ver o JSON exato antes de qualquer chamada real ser enviada.
    # ------------------------------------------------------------------

    async def get_merchant_details(self, merchant_id: str) -> dict[str, Any]:
        return await self.request("GET", f"/merchant/v1.0/merchants/{merchant_id}")

    async def get_merchant_status(self, merchant_id: str) -> Any:
        return await self.request("GET", f"/merchant/v1.0/merchants/{merchant_id}/status")

    async def list_interruptions(self, merchant_id: str) -> list[dict[str, Any]]:
        payload = await self.request("GET", f"/merchant/v1.0/merchants/{merchant_id}/interruptions")
        return payload if isinstance(payload, list) else payload.get("interruptions", [])

    async def create_interruption(
        self, merchant_id: str, *, description: str, start: str, end: str
    ) -> dict[str, Any]:
        """`start`/`end` em ISO 8601 (horário local da loja). O iFood ignora
        qualquer timezone enviado no payload e usa sempre o fuso da loja."""
        return await self.request(
            "POST",
            f"/merchant/v1.0/merchants/{merchant_id}/interruptions",
            json={"description": description, "start": start, "end": end},
        )

    async def delete_interruption(self, merchant_id: str, interruption_id: str) -> None:
        await self.request(
            "DELETE", f"/merchant/v1.0/merchants/{merchant_id}/interruptions/{interruption_id}"
        )

    async def get_opening_hours(self, merchant_id: str) -> Any:
        return await self.request("GET", f"/merchant/v1.0/merchants/{merchant_id}/opening-hours")

    async def set_opening_hours(self, merchant_id: str, shifts: list[dict[str, Any]]) -> Any:
        """`shifts`: lista de {"dayOfWeek": "SATURDAY", "start": "10:00:00", "duration": <minutos>}.
        O payload precisa do "storeId" (= merchantId) no nível raiz, e o "start"
        precisa vir com segundos (HH:MM:SS) — sem isso o iFood recusa com 400."""
        return await self.request(
            "PUT",
            f"/merchant/v1.0/merchants/{merchant_id}/opening-hours",
            json={"storeId": merchant_id, "shifts": shifts},
        )

    # -- Catalog (escrita) ----------------------------------------------

    async def list_catalogs(self, merchant_id: str) -> list[dict[str, Any]]:
        """Passo 1 do guia oficial: GET /catalogs devolve o(s) catalogId(s)
        da loja. Toda loja já tem pelo menos um catálogo padrão."""
        payload = await self.request("GET", f"/catalog/v2.0/merchants/{merchant_id}/catalogs")
        return payload if isinstance(payload, list) else payload.get("catalogs", [])

    async def list_category_items(self, merchant_id: str, category_id: str) -> Any:
        """Passo 5 do guia oficial: confirma que o item (com complementos,
        se houver) foi salvo dentro da categoria."""
        return await self.request(
            "GET", f"/catalog/v2.0/merchants/{merchant_id}/categories/{category_id}/items"
        )

    async def delete_item(self, merchant_id: str, category_id: str, product_id: str) -> None:
        """DELETE /categories/{categoryId}/products/{productId} — remove o
        item da categoria (a rota usa o productId, não o itemId)."""
        await self.request(
            "DELETE",
            f"/catalog/v2.0/merchants/{merchant_id}/categories/{category_id}/products/{product_id}",
        )

    async def delete_category(self, merchant_id: str, category_id: str) -> None:
        await self.request(
            "DELETE", f"/catalog/v2.0/merchants/{merchant_id}/categories/{category_id}"
        )

    async def upload_image(self, merchant_id: str, image_path: Path) -> str:
        """O endpoint espera JSON com a imagem em base64 (data URI), não
        multipart/form-data — mandar como multipart deu "Something went wrong,
        please try again later" em teste real."""
        mime_type = mimetypes.guess_type(str(image_path))[0] or "image/jpeg"
        encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
        payload = await self.request(
            "POST",
            f"/catalog/v2.0/merchants/{merchant_id}/image/upload/",
            json={"image": f"data:{mime_type};base64,{encoded}"},
        )
        return payload.get("imagePath") or payload.get("path") or ""

    async def create_category(
        self, merchant_id: str, *, name: str, status: str = "AVAILABLE", catalog_id: str | None = None
    ) -> dict[str, Any]:
        """POST direto em /categories (sem catalogId no path) deu
        "no Route matched with those values" em teste real — a rota exige o
        catalogId no path. Se não vier, busca automaticamente via list_catalogs
        (Passo 1) e usa o primeiro catálogo disponível."""
        if not catalog_id:
            catalogs = await self.list_catalogs(merchant_id)
            if not catalogs:
                raise IFoodAPIError("Loja sem nenhum catálogo (GET /catalogs vazio).", 502)
            catalog_id = catalogs[0]["catalogId"]
        return await self.request(
            "POST",
            f"/catalog/v2.0/merchants/{merchant_id}/catalogs/{catalog_id}/categories",
            json={"name": name, "status": status, "template": "DEFAULT"},
        )

    async def put_item(self, merchant_id: str, payload: dict[str, Any]) -> Any:
        """Cria/edita item, products, optionGroups e options em uma única
        chamada. O PUT substitui o estado inteiro do item: sempre reenvie
        os 4 campos (item, products, optionGroups, options) completos,
        mesmo quando algum estiver vazio."""
        return await self.request("PUT", f"/catalog/v2.0/merchants/{merchant_id}/items", json=payload)

    async def patch_items_price(self, merchant_id: str, payload: dict[str, Any]) -> Any:
        """Confirmado no Swagger: esse endpoint em lote está deprecado
        ("Use the PATCH '/{merchantId}/items/{itemId}' endpoint instead"),
        e dá erro real "PatchItemPriceDto is not valid". Mantido só por
        compatibilidade; use patch_item() para itens individuais."""
        return await self.request(
            "PATCH", f"/catalog/v2.0/merchants/{merchant_id}/items/price", json=payload
        )

    async def patch_items_status(self, merchant_id: str, payload: dict[str, Any]) -> Any:
        """Também deprecado no Swagger — use patch_item()."""
        return await self.request(
            "PATCH", f"/catalog/v2.0/merchants/{merchant_id}/items/status", json=payload
        )

    async def patch_item(self, merchant_id: str, item_id: str, payload: dict[str, Any]) -> Any:
        """Endpoint atual (não deprecado) pra alterar um item individual via
        JSON Merge Patch — substitui os antigos patch_items_price/status em
        lote. payload é só os campos que devem mudar, ex.: {"price": {"value": 27.5}}
        ou {"status": "PAUSED"}."""
        return await self.request(
            "PATCH", f"/catalog/v2.0/merchants/{merchant_id}/items/{item_id}", json=payload
        )

    async def patch_options_price(self, merchant_id: str, payload: dict[str, Any]) -> Any:
        return await self.request(
            "PATCH", f"/catalog/v2.0/merchants/{merchant_id}/options/price", json=payload
        )

    async def patch_options_status(self, merchant_id: str, payload: dict[str, Any]) -> Any:
        return await self.request(
            "PATCH", f"/catalog/v2.0/merchants/{merchant_id}/options/status", json=payload
        )
