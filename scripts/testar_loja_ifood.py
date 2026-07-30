from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env.local")

from backend.catalog import normalize_categories
from backend.ifood_client import IFoodAPIError, IFoodClient


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Testa itens ativos e pausados das lojas vinculadas ao iFood."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--all", action="store_true", help="Testa todas as lojas.")
    group.add_argument("--merchant-id", help="Testa somente o UUID informado.")
    parser.add_argument("--json", action="store_true", help="Imprime o resultado em JSON.")
    return parser.parse_args()


def choose_merchant(merchants: list[dict[str, str]]) -> dict[str, str]:
    print("\nLojas vinculadas à credencial:\n")
    for index, merchant in enumerate(merchants, start=1):
        print(f"  {index}. {merchant['name']}  [{merchant['id']}]")

    while True:
        answer = input("\nNúmero da loja para testar: ").strip()
        if answer.isdigit() and 1 <= int(answer) <= len(merchants):
            return merchants[int(answer) - 1]
        print("Escolha um número válido da lista.")


async def inspect_merchant(client: IFoodClient, merchant: dict[str, str]) -> dict:
    result = {
        "merchantId": merchant["id"],
        "loja": merchant["name"],
        "categorias": 0,
        "totalItens": 0,
        "itensAtivos": 0,
        "itensPausados": 0,
        "status": "ok",
    }
    try:
        categories = await client.list_categories(merchant["id"])
        items = normalize_categories(categories, merchant["name"])
        result.update(
            categorias=len(categories),
            totalItens=len(items),
            itensAtivos=sum(item["status"] == "Ativo" for item in items),
            itensPausados=sum(item["status"] == "Pausado" for item in items),
        )
        if result["itensAtivos"] + result["itensPausados"] != result["totalItens"]:
            result["status"] = "inconsistente"
    except (IFoodAPIError, httpx.HTTPError, OSError, ValueError) as error:
        result["status"] = "erro"
        result["erro"] = str(error)
    return result


def print_table(results: list[dict]) -> None:
    print("\nResultado por loja")
    print("-" * 105)
    print(f"{'Loja':35} {'Categorias':>10} {'Total':>8} {'Ativos':>8} {'Pausados':>9}  Status")
    print("-" * 105)
    for item in results:
        name = item["loja"][:35]
        print(
            f"{name:35} {item['categorias']:>10} {item['totalItens']:>8} "
            f"{item['itensAtivos']:>8} {item['itensPausados']:>9}  {item['status']}"
        )
        if item.get("erro"):
            print(f"  Erro: {item['erro']}")


async def run() -> int:
    args = arguments()
    client = IFoodClient()

    try:
        print("Autenticando e buscando lojas autorizadas...")
        merchants = await client.list_merchants()
        if not merchants:
            print("Nenhuma loja foi retornada para esta credencial.")
            return 2

        if args.all:
            selected = merchants
        elif args.merchant_id:
            selected = [
                item for item in merchants if item["id"].lower() == args.merchant_id.lower()
            ]
            if not selected:
                print("A credencial não possui acesso ao merchantId informado.")
                return 3
        else:
            selected = [choose_merchant(merchants)]

        results = []
        for index, merchant in enumerate(selected, start=1):
            if not args.json:
                print(f"[{index}/{len(selected)}] Lendo {merchant['name']}...")
            results.append(await inspect_merchant(client, merchant))
            if args.all and index < len(selected):
                await asyncio.sleep(0.2)

        totals = {
            "lojasEncontradas": len(merchants),
            "lojasTestadas": len(results),
            "lojasComSucesso": sum(item["status"] == "ok" for item in results),
            "lojasComErro": sum(item["status"] == "erro" for item in results),
            "totalItens": sum(item["totalItens"] for item in results),
            "itensAtivos": sum(item["itensAtivos"] for item in results),
            "itensPausados": sum(item["itensPausados"] for item in results),
        }

        if args.json:
            print(json.dumps({"totais": totals, "lojas": results}, ensure_ascii=False, indent=2))
        else:
            print_table(results)
            print("\nResumo")
            print("-" * 40)
            print(f"Lojas encontradas: {totals['lojasEncontradas']}")
            print(f"Lojas testadas:    {totals['lojasTestadas']}")
            print(f"Com sucesso:       {totals['lojasComSucesso']}")
            print(f"Com erro:          {totals['lojasComErro']}")
            print(f"Itens ativos:      {totals['itensAtivos']}")
            print(f"Itens pausados:    {totals['itensPausados']}")

        return 1 if totals["lojasComErro"] else 0
    except IFoodAPIError as error:
        print(f"\nO iFood recusou a consulta: {error}")
        print(
            "Se o OAuth ainda não tem Merchant/Catalog, use um Bearer manual no backend. "
            "O token do Portal pode ter outro público e não funcionar na merchant-api."
        )
        return 1
    except (httpx.HTTPError, OSError, ValueError) as error:
        print(f"\nFalha local: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
