from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env.local")

from backend.catalog import items_to_csv, normalize_categories  # noqa: E402
from backend.ifood_client import IFoodAPIError, IFoodClient  # noqa: E402

# Este script não guarda nenhuma credencial. IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET
# são lidos exclusivamente do .env.local (nunca commitado — ver .gitignore).
# Quando o job automático existir (n8n, cron, etc.), ele deve chamar exatamente
# essas mesmas funções (IFoodClient + normalize_categories), só trocando o destino
# do resultado (hoje: CSV em data/staging; futuro: Postgres ou outro storage).


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Extrai itens ativos/pausados de todas as lojas iFood (Merchant + Catalog) "
            "e gera um snapshot CSV no mesmo layout do relatório usado hoje pelo portal "
            "(ver CSV_HEADERS em backend/catalog.py). Use --test-token para testar só a "
            "geração do access_token e diagnosticar problema de permissão/loja vinculada."
        )
    )
    parser.add_argument(
        "--test-token",
        action="store_true",
        help="Testa a geração do access_token (client_credentials) e diagnostica erros de permissão.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Caminho do CSV de saída (padrão: data/staging/ifood_snapshot_<timestamp>.csv).",
    )
    return parser.parse_args()


async def test_token_only() -> int:
    """Testa se dá pra gerar access_token com as credenciais atuais.

    Confirmado em teste real (inclusive na própria tela "Permissões" do app no
    Developer Portal): a iFood só emite o access_token se o app tiver pelo menos
    uma loja autorizada, e nenhuma loja pode autorizar o app antes dele estar
    HOMOLOGADO — nem a loja de teste. Ou seja, para um app recém-criado (mesmo
    "Aplicativo centralizado — Teste"), é normal e esperado que essa chamada
    falhe com 403 até a homologação (Merchant + Catalog) ser concluída no
    Developer Portal.
    """
    client = IFoodClient()
    print("Testando a etapa de autenticação...\n")

    if client.auth_mode != "manual" and (not client.client_id or not client.client_secret):
        print("IFOOD_CLIENT_ID / IFOOD_CLIENT_SECRET estão vazios no .env.local.")
        print("Preencha essas duas variáveis (geradas ao registrar o app no Developer Portal).")
        return 2

    try:
        token, source = await client.get_access_token()
    except IFoodAPIError as error:
        status = getattr(error, "status_code", None)
        print(f"O iFood recusou a autenticação (status {status}): {error}")
        print(
            "Esperado enquanto o app não estiver homologado: na aba 'Permissões' do\n"
            "app, o Developer Portal mostra 'O aplicativo precisa estar homologado\n"
            "para receber autorização' — ou seja, nenhuma loja (nem a de teste) pode\n"
            "autorizar o app antes disso, então o /oauth/token também é recusado.\n"
            "Próximo passo: abrir um chamado de homologação no Developer Portal\n"
            "(Central de Ajuda / Suporte) pedindo os módulos Merchant e Catalog.\n"
            "Depois de homologado, volte a rodar este script para confirmar o token\n"
            "e, em seguida, rode sem --test-token para extrair Merchant + Catalog."
        )
        return 1

    expires_at = datetime.fromtimestamp(token.expires_at, tz=timezone.utc).isoformat()
    print("Token obtido com sucesso.")
    print(f"  Origem:    {source}")
    print(f"  Expira em: {token.expires_in}s")
    print(f"  Expira às: {expires_at} (UTC)")

    print("\nTestando list_merchants() (Merchant) como diagnóstico:")
    try:
        merchants = await client.list_merchants()
        print(f"  Retornou {len(merchants)} loja(s).")
    except IFoodAPIError as error:
        print(f"  Falhou: {error}")
    return 0


async def extract_all(output: Path) -> int:
    client = IFoodClient()
    try:
        print("Autenticando...")
        await client.get_access_token()
        print("Buscando lojas vinculadas à credencial (Merchant)...")
        merchants = await client.list_merchants()
        if not merchants:
            print("Nenhuma loja retornada para esta credencial.")
            return 2

        all_items: list[dict[str, str]] = []
        for index, merchant in enumerate(merchants, start=1):
            print(f"[{index}/{len(merchants)}] {merchant['name']}...")
            try:
                categories = await client.list_categories(merchant["id"])
                all_items.extend(normalize_categories(categories, merchant["name"]))
            except IFoodAPIError as error:
                print(f"  Falhou: {error}")
            if index < len(merchants):
                await asyncio.sleep(0.2)

        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(items_to_csv(all_items), encoding="utf-8")

        total = len(all_items)
        paused = sum(item["status"] == "Pausado" for item in all_items)
        print(f"\nSnapshot salvo em: {output}")
        print(
            f"Lojas: {len(merchants)} | Itens: {total} | "
            f"Ativos: {total - paused} | Pausados: {paused}"
        )
        return 0
    except IFoodAPIError as error:
        print(f"\nO iFood recusou a consulta: {error}")
        return 1


def run() -> int:
    args = arguments()
    if args.test_token:
        return asyncio.run(test_token_only())

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    default_output = ROOT / "data" / "staging" / f"ifood_snapshot_{timestamp}.csv"
    output = Path(args.output) if args.output else default_output
    return asyncio.run(extract_all(output))


if __name__ == "__main__":
    raise SystemExit(run())
