import asyncio

import httpx

from backend.ifood_client import IFoodAPIError, IFoodClient


def mock_client(handler):
    transport = httpx.MockTransport(handler)
    return httpx.AsyncClient(transport=transport)


def test_token_e_reutilizado_em_cache():
    async def scenario():
        calls = []

        def handler(request):
            calls.append(request)
            return httpx.Response(200, json={"accessToken": "token-seguro", "expiresIn": 3600})

        async with mock_client(handler) as http:
            client = IFoodClient("client-test", "secret-test", http_client=http)
            first, first_source = await client.get_access_token()
            second, second_source = await client.get_access_token()

        assert first.access_token == second.access_token == "token-seguro"
        assert first_source == "ifood"
        assert second_source == "cache"
        assert len(calls) == 1
        assert b"grantType=client_credentials" in calls[0].content
        assert "secret-test" not in repr(first)

    asyncio.run(scenario())


def test_renova_token_apos_401():
    async def scenario():
        token_calls = 0
        api_calls = 0

        def handler(request):
            nonlocal token_calls, api_calls
            if request.url.path.endswith("/oauth/token"):
                token_calls += 1
                return httpx.Response(200, json={"accessToken": f"token-{token_calls}", "expiresIn": 3600})
            api_calls += 1
            if api_calls == 1:
                return httpx.Response(401, json={"message": "expired"})
            return httpx.Response(200, json=[{"id": "merchant-1", "name": "Ital Centro"}])

        async with mock_client(handler) as http:
            client = IFoodClient("client-test", "secret-test", http_client=http)
            merchants = await client.list_merchants()

        assert merchants[0]["name"] == "Ital Centro"
        assert token_calls == 2
        assert api_calls == 2

    asyncio.run(scenario())


def test_permissao_negada_retorna_403_sem_expor_client_id():
    async def scenario():
        def handler(request):
            return httpx.Response(
                403,
                json={
                    "error": (
                        "No permissions granted to client "
                        "client-test"
                    )
                },
            )

        async with mock_client(handler) as http:
            client = IFoodClient(
                "client-test",
                "secret-test",
                http_client=http,
            )
            try:
                await client.get_access_token()
                raise AssertionError("Era esperado IFoodAPIError")
            except IFoodAPIError as error:
                assert error.status_code == 403
                assert "Merchant e Catalog" in str(error)
                assert "client-test" not in str(error)

    asyncio.run(scenario())


def test_token_manual_remove_prefixo_bearer(monkeypatch):
    monkeypatch.setenv("IFOOD_AUTH_MODE", "manual")
    monkeypatch.setenv("IFOOD_TOKEN", "Bearer token-renovado")

    async def scenario():
        client = IFoodClient()
        token, source = await client.get_access_token()
        assert token.access_token == "token-renovado"
        assert source == "manual"

    asyncio.run(scenario())
