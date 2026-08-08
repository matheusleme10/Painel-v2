from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env.local")

from backend.ifood_client import IFoodAPIError, IFoodClient  # noqa: E402

# Script de apoio para GRAVAR os vídeos que o suporte do iFood pediu na
# homologação dos módulos Merchant e Catalog (chamado de 31/jul). Cada
# função abaixo corresponde a um cenário do checklist enviado por eles.
#
# IMPORTANTE — leia antes de gravar:
# Os nomes de campo dos payloads de Catalog (PUT /items, PATCH .../price,
# PATCH .../status) foram levantados na documentação pública do iFood, mas
# essa API é sensível a versão/conta. Rode primeiro com --dry-run: o script
# imprime o JSON exato que enviaria, sem chamar a API. Compare esse JSON
# com o "API Reference" (Swagger) do seu app no Developer Portal antes de
# soltar sem --dry-run e começar a gravar de verdade — assim você não
# gasta a gravação em cima de um payload errado.
#
# O estado do item/complementos criado é salvo em
# data/staging/homologacao_state.json, porque o checklist pede um vídeo
# separado por cenário (ou seja, execuções separadas do script).

STATE_PATH = ROOT / "data" / "staging" / "homologacao_state.json"


def load_state() -> dict[str, Any]:
    if STATE_PATH.is_file():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {}


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def pause(label: str, enabled: bool) -> None:
    if enabled:
        input(f"\n>>> {label} — pressione Enter para continuar gravando...")


def dump(title: str, payload: Any) -> None:
    print(f"\n--- {title} ---")
    print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))


def new_id() -> str:
    return str(uuid.uuid4())


def item_block(
    item_id: str, category_id: str, product_id: str, price: float, status: str = "AVAILABLE"
) -> dict[str, Any]:
    """Monta o bloco 'item' do PUT /items. Confirmado no schema real do
    Swagger (API Reference) do Developer Portal: o item tem um campo
    'productId' próprio, além do array 'products' com os dados do produto —
    a gente nunca enviava 'productId', o que provavelmente causava o
    "FullItemDto is not valid" (falha de validação no nível do objeto,
    sem apontar campo específico, típica de uma checagem tipo "productId
    deve corresponder a um produto do array products")."""
    return {
        "id": item_id,
        "type": "DEFAULT",
        "categoryId": category_id,
        "productId": product_id,
        "status": status,
        "price": {"value": price},
        "externalCode": f"HOMOLOG_{item_id[:8]}",
    }


def duration_minutes(start: str, end: str) -> int:
    start_h, start_m = (int(part) for part in start.split(":"))
    end_h, end_m = (int(part) for part in end.split(":"))
    return (end_h * 60 + end_m) - (start_h * 60 + start_m)


async def maybe_call(dry_run: bool, label: str, factory: Callable[[], Awaitable[Any]]) -> Any:
    if dry_run:
        print(f"[dry-run] {label} — nada foi enviado para a API.")
        return {"dryRun": True}
    return await factory()


# ---------------------------------------------------------------------
# Cenários Merchant
# ---------------------------------------------------------------------

async def cenario_merchant_1(client: IFoodClient, merchant_id: str, pausar: bool, dry_run: bool) -> None:
    print("Cenário 1 (Merchant) — Informações da Loja\n")

    print("1a) Listando lojas vinculadas à credencial...")
    merchants = await maybe_call(dry_run, "GET /merchants", client.list_merchants)
    dump("Lojas vinculadas", merchants)
    pause("Listagem de lojas mostrada", pausar)

    print("1b) Detalhes completos da loja...")
    details = await maybe_call(
        dry_run, "GET /merchants/{id}", lambda: client.get_merchant_details(merchant_id)
    )
    dump("Detalhes da loja", details)
    pause("Detalhes da loja mostrados", pausar)

    print("1c) Disponibilidade da loja...")
    status = await maybe_call(
        dry_run, "GET /merchants/{id}/status", lambda: client.get_merchant_status(merchant_id)
    )
    dump("Status/disponibilidade", status)
    pause("Disponibilidade mostrada", pausar)


async def cenario_merchant_2(client: IFoodClient, merchant_id: str, pausar: bool, dry_run: bool) -> None:
    print("Cenário 2 (Merchant) — Interrupção na Loja\n")
    start = datetime.now(timezone.utc)
    end = start + timedelta(hours=1)

    print("2a) Cadastrando pausa...")
    created = await maybe_call(
        dry_run,
        "POST /merchants/{id}/interruptions",
        lambda: client.create_interruption(
            merchant_id,
            description="Pausa teste homologacao",
            start=start.isoformat(timespec="seconds"),
            end=end.isoformat(timespec="seconds"),
        ),
    )
    dump("Pausa criada", created)
    print("Agora mostre, no Portal do Parceiro, a loja aparecendo pausada.")
    pause("Reflexo no Portal do Parceiro mostrado", pausar)

    print("2b) Listando pausas ativas...")
    active = await maybe_call(
        dry_run, "GET /merchants/{id}/interruptions", lambda: client.list_interruptions(merchant_id)
    )
    dump("Pausas ativas", active)
    pause("Lista de pausas ativas mostrada", pausar)

    interruption_id = None
    if isinstance(created, dict):
        interruption_id = created.get("id")
    if not interruption_id and isinstance(active, list) and active:
        interruption_id = active[0].get("id")

    if dry_run:
        interruption_id = interruption_id or "<id-fake-dry-run>"
    elif not interruption_id:
        print("Não encontrei o id da pausa criada — remova manualmente no Portal do Parceiro.")
        return

    print(f"2c) Removendo a pausa {interruption_id}...")
    await maybe_call(
        dry_run,
        "DELETE /merchants/{id}/interruptions/{interruptionId}",
        lambda: client.delete_interruption(merchant_id, interruption_id),
    )
    print("Pausa removida. Mostre, no Portal do Parceiro, a loja voltando a operar.")
    pause("Loja voltando a operar mostrada", pausar)


async def cenario_merchant_3(client: IFoodClient, merchant_id: str, pausar: bool, dry_run: bool) -> None:
    print("Cenário 3 (Merchant) — Horário de Funcionamento\n")
    shifts = [
        {"dayOfWeek": "SATURDAY", "start": "10:00:00", "duration": duration_minutes("10:00", "19:00")},
        {"dayOfWeek": "SUNDAY", "start": "09:00:00", "duration": duration_minutes("09:00", "12:00")},
        {"dayOfWeek": "SUNDAY", "start": "13:00:00", "duration": duration_minutes("13:00", "16:00")},
        {"dayOfWeek": "SUNDAY", "start": "17:00:00", "duration": duration_minutes("17:00", "23:00")},
    ]
    dump("Horários que serão enviados (Sábado 10-19h; Domingo 09-12h, 13-16h, 17-23h)", shifts)
    print(
        "Payload também inclui 'storeId' no nível raiz (feito automaticamente pelo "
        "set_opening_hours). Se ainda assim der 400, confira o formato exato no API Reference."
    )
    pause("Formato conferido, cadastrando horário", pausar)

    result = await maybe_call(
        dry_run, "PUT /merchants/{id}/opening-hours", lambda: client.set_opening_hours(merchant_id, shifts)
    )
    dump("Resposta do cadastro de horário", result)
    pause("Cadastro de horário feito", pausar)

    print("Consultando horários configurados...")
    current = await maybe_call(
        dry_run, "GET /merchants/{id}/opening-hours", lambda: client.get_opening_hours(merchant_id)
    )
    dump("Horários configurados", current)
    print("Mostre agora, no Portal do Parceiro, o mesmo horário refletido.")
    pause("Reflexo no Portal do Parceiro mostrado", pausar)


# ---------------------------------------------------------------------
# Cenários Catalog
# ---------------------------------------------------------------------

async def cenario_catalog_1(
    client: IFoodClient, merchant_id: str, foto: str | None, pausar: bool, dry_run: bool, state: dict[str, Any]
) -> dict[str, Any]:
    print("Cenário 1 (Catalog) — Categoria + Item\n")

    print("1a) Listando catálogos da loja (Passo 1 do guia oficial)...")
    catalogs = await maybe_call(dry_run, "GET /merchants/{id}/catalogs", lambda: client.list_catalogs(merchant_id))
    dump("Catálogos", catalogs)
    catalog_id = catalogs[0]["catalogId"] if (not dry_run and catalogs) else "<catalogId-dry-run>"
    pause("Catálogo identificado", pausar)

    print("1b) Criando categoria 'Teste Homologação'...")
    try:
        category = await maybe_call(
            dry_run,
            "POST /merchants/{id}/catalogs/{catalogId}/categories",
            lambda: client.create_category(merchant_id, name="Teste Homologação", catalog_id=catalog_id),
        )
    except IFoodAPIError as error:
        if "already exist" not in str(error).lower():
            raise
        print(
            "Categoria 'Teste Homologação' já existe (de uma execução anterior que não "
            "chegou a terminar) — reaproveitando em vez de criar de novo."
        )
        existing = await client.list_categories(merchant_id)
        category = next((c for c in existing if c.get("name") == "Teste Homologação"), None)
        if category is None:
            raise
    dump("Categoria (criada ou reaproveitada)", category)
    category_id = category.get("id") if isinstance(category, dict) else None
    pause("Categoria pronta", pausar)

    image_path = ""
    if foto:
        print(f"1c) Enviando foto do item ({foto})...")
        image_path = await maybe_call(
            dry_run, "POST /merchants/{id}/image/upload", lambda: client.upload_image(merchant_id, Path(foto))
        )
        print(f"imagePath retornado: {image_path}")
        pause("Foto enviada", pausar)
    else:
        print("1c) Nenhuma foto informada (--item-photo) — pulando upload.")

    item_id = new_id()
    product_id = new_id()
    payload = {
        "item": item_block(item_id, category_id, product_id, 25.0),
        "products": [
            {
                "id": product_id,
                "name": "Produto Teste",
                "description": "Item criado para homologação",
                "externalCode": f"HOMOLOG_PROD_{product_id[:8]}",
                **({"imagePath": image_path} if image_path else {}),
            }
        ],
        "optionGroups": [],
        "options": [],
    }
    dump("Payload do item — CONFIRA contra o API Reference antes de enviar", payload)
    print("1d) Criando o item...")
    pause("Payload conferido, criando item", pausar)

    result = await maybe_call(dry_run, "PUT /merchants/{id}/items", lambda: client.put_item(merchant_id, payload))
    dump("Resposta da criação do item", result)
    pause("Item criado", pausar)

    print("1e) Verificando: listando itens da categoria para confirmar que salvou...")
    verification = await maybe_call(
        dry_run,
        "GET /merchants/{id}/categories/{categoryId}/items",
        lambda: client.list_category_items(merchant_id, category_id),
    )
    dump("Itens da categoria (deve aparecer o item criado)", verification)
    pause("Verificação mostrada", pausar)

    state.update(
        category_id=category_id,
        item_id=item_id,
        product_id=product_id,
        image_path=image_path,
        item_price=25.0,
    )
    if not dry_run:
        save_state(state)
    else:
        print("[dry-run] Estado não foi salvo (evita contaminar homologacao_state.json com IDs fake).")
    return state


async def cenario_catalog_2(
    client: IFoodClient,
    merchant_id: str,
    foto1: str | None,
    foto2: str | None,
    pausar: bool,
    dry_run: bool,
    state: dict[str, Any],
) -> dict[str, Any]:
    print("Cenário 2 (Catalog) — Grupo de Complementos + 2 Complementos\n")
    if not state.get("item_id"):
        print(
            "Não encontrei o item do Cenário 1 em data/staging/homologacao_state.json.\n"
            "Rode primeiro (sem --dry-run): python scripts/homologacao_ifood.py --merchant-id <ID> catalog-1"
        )
        return state

    group_id = new_id()
    option1_id = new_id()
    option2_id = new_id()
    complement1_product_id = new_id()
    complement2_product_id = new_id()

    image1 = ""
    if foto1:
        print(f"Enviando foto do complemento 1 ({foto1})...")
        image1 = await maybe_call(
            dry_run, "POST /merchants/{id}/image/upload (complemento 1)",
            lambda: client.upload_image(merchant_id, Path(foto1)),
        )
    image2 = ""
    if foto2:
        print(f"Enviando foto do complemento 2 ({foto2})...")
        image2 = await maybe_call(
            dry_run, "POST /merchants/{id}/image/upload (complemento 2)",
            lambda: client.upload_image(merchant_id, Path(foto2)),
        )
    pause("Fotos enviadas (se informadas)", pausar)

    payload = {
        "item": item_block(state["item_id"], state["category_id"], state["product_id"], state.get("item_price", 25.0)),
        "products": [
            {
                "id": state["product_id"],
                "name": "Produto Teste",
                "description": "Item criado para homologação",
                "externalCode": f"HOMOLOG_PROD_{state['product_id'][:8]}",
                **({"imagePath": state["image_path"]} if state.get("image_path") else {}),
                "optionGroups": [{"id": group_id, "min": 0, "max": 2}],
            },
            {
                "id": complement1_product_id,
                "name": "Complemento 1",
                "externalCode": f"HOMOLOG_COMP1_{complement1_product_id[:8]}",
                **({"imagePath": image1} if image1 else {}),
            },
            {
                "id": complement2_product_id,
                "name": "Complemento 2",
                "externalCode": f"HOMOLOG_COMP2_{complement2_product_id[:8]}",
                **({"imagePath": image2} if image2 else {}),
            },
        ],
        "optionGroups": [
            {
                "id": group_id,
                "name": "Complementos",
                "status": "AVAILABLE",
                "optionGroupType": "OFFER_UNIT",
                "optionIds": [option1_id, option2_id],
            }
        ],
        "options": [
            {
                "id": option1_id,
                "productId": complement1_product_id,
                "status": "AVAILABLE",
                "price": {"value": 5.0},
            },
            {
                "id": option2_id,
                "productId": complement2_product_id,
                "status": "AVAILABLE",
                "price": {"value": 6.0},
            },
        ],
    }
    dump("Payload com grupo de complementos — CONFIRA contra o API Reference antes de enviar", payload)
    print(
        "Repare que o item/produto do Cenário 1 é reenviado por completo — o PUT /items "
        "substitui o estado inteiro, não é incremental."
    )
    pause("Payload conferido, enviando", pausar)

    result = await maybe_call(dry_run, "PUT /merchants/{id}/items", lambda: client.put_item(merchant_id, payload))
    dump("Resposta", result)
    pause("Grupo de complementos enviado", pausar)

    print("Verificando: listando itens da categoria para confirmar os complementos...")
    verification = await maybe_call(
        dry_run,
        "GET /merchants/{id}/categories/{categoryId}/items",
        lambda: client.list_category_items(merchant_id, state["category_id"]),
    )
    dump("Itens da categoria (deve mostrar o item com os 2 complementos)", verification)
    pause("Verificação mostrada", pausar)

    state.update(
        group_id=group_id,
        option1_id=option1_id,
        option2_id=option2_id,
        complement1_product_id=complement1_product_id,
        complement2_product_id=complement2_product_id,
        complement1_image=image1,
        complement2_image=image2,
        complement2_price=6.0,
    )
    if not dry_run:
        save_state(state)
    else:
        print("[dry-run] Estado não foi salvo (evita contaminar homologacao_state.json com IDs fake).")
    return state


async def cenario_catalog_3(
    client: IFoodClient,
    merchant_id: str,
    pausar: bool,
    dry_run: bool,
    state: dict[str, Any],
    novo_nome_item: str,
    novo_nome_complemento: str,
) -> None:
    print("Cenário 3 (Catalog) — Alteração de Item e Complemento\n")
    if not state.get("option1_id"):
        print(
            "Não encontrei os complementos do Cenário 2 em data/staging/homologacao_state.json.\n"
            "Rode antes (sem --dry-run): catalog-1 e depois catalog-2."
        )
        return

    print(
        "3a) Nome e foto são alterados reenviando o PUT /items completo (o PATCH cobre só "
        "preço e status). Renomeando item e complemento 1..."
    )
    payload = {
        "item": item_block(state["item_id"], state["category_id"], state["product_id"], state.get("item_price", 25.0)),
        "products": [
            {
                "id": state["product_id"],
                "name": novo_nome_item,
                "description": "Item editado na homologação",
                "externalCode": f"HOMOLOG_PROD_{state['product_id'][:8]}",
                **({"imagePath": state["image_path"]} if state.get("image_path") else {}),
                "optionGroups": [{"id": state["group_id"], "min": 0, "max": 2}],
            },
            {
                "id": state["complement1_product_id"],
                "name": novo_nome_complemento,
                "externalCode": f"HOMOLOG_COMP1_{state['complement1_product_id'][:8]}",
                **({"imagePath": state["complement1_image"]} if state.get("complement1_image") else {}),
            },
            {
                "id": state["complement2_product_id"],
                "name": "Complemento 2",
                "externalCode": f"HOMOLOG_COMP2_{state['complement2_product_id'][:8]}",
                **({"imagePath": state["complement2_image"]} if state.get("complement2_image") else {}),
            },
        ],
        "optionGroups": [
            {
                "id": state["group_id"],
                "name": "Complementos",
                "status": "AVAILABLE",
                "optionGroupType": "OFFER_UNIT",
                "optionIds": [state["option1_id"], state["option2_id"]],
            }
        ],
        "options": [
            {"id": state["option1_id"], "productId": state["complement1_product_id"], "status": "AVAILABLE", "price": {"value": 5.0}},
            {"id": state["option2_id"], "productId": state["complement2_product_id"], "status": "AVAILABLE", "price": {"value": state.get("complement2_price", 6.0)}},
        ],
    }
    dump("Payload PUT /items com nomes alterados — CONFIRA antes de enviar", payload)
    pause("Payload conferido, enviando renomeação", pausar)
    dump("Resposta", await maybe_call(dry_run, "PUT /merchants/{id}/items", lambda: client.put_item(merchant_id, payload)))

    print("\n3b) PATCH items/{itemId} — novo preço do item (endpoint em lote está deprecado)...")
    price_payload = {"price": {"value": 27.5}}
    dump("Payload PATCH items/{itemId} — CONFIRA contra o API Reference antes de enviar", price_payload)
    pause("Conferido, enviando", pausar)
    dump(
        "Resposta",
        await maybe_call(
            dry_run, "PATCH items/{itemId}", lambda: client.patch_item(merchant_id, state["item_id"], price_payload)
        ),
    )
    state["item_price"] = 27.5

    print("\n3c) PATCH options/status — pausando o complemento 1...")
    status_payload = {"optionId": state["option1_id"], "status": "UNAVAILABLE"}
    dump("Payload PATCH options/status — CONFIRA antes de enviar", status_payload)
    pause("Conferido, enviando", pausar)
    dump("Resposta", await maybe_call(dry_run, "PATCH options/status", lambda: client.patch_options_status(merchant_id, status_payload)))

    print("\n3d) Repita 3b/3c para o segundo complemento: novo preço (PATCH options/price)")
    print("    e pausa (PATCH options/status) do complemento 2.")
    option_price_payload = {"optionId": state["option2_id"], "price": {"value": 7.0}}
    dump("Payload PATCH options/price (complemento 2) — CONFIRA antes de enviar", option_price_payload)
    pause("Conferido, enviando", pausar)
    dump("Resposta", await maybe_call(dry_run, "PATCH options/price", lambda: client.patch_options_price(merchant_id, option_price_payload)))
    state["complement2_price"] = 7.0

    status2_payload = {"optionId": state["option2_id"], "status": "UNAVAILABLE"}
    dump("Payload PATCH options/status (complemento 2) — CONFIRA antes de enviar", status2_payload)
    pause("Conferido, enviando", pausar)
    dump("Resposta", await maybe_call(dry_run, "PATCH options/status", lambda: client.patch_options_status(merchant_id, status2_payload)))

    if not dry_run:
        save_state(state)
    else:
        print("[dry-run] Estado não foi salvo (evita contaminar homologacao_state.json com IDs fake).")


async def catalog_check(client: IFoodClient, merchant_id: str) -> None:
    """Diagnóstico rápido e só-leitura: confirma se o módulo Catalog está
    provisionado pra esse merchant antes de tentar criar categoria/item."""
    print("Verificando se o módulo Catalog está liberado para essa loja (GET /catalogs)...")
    catalogs = await client.list_catalogs(merchant_id)
    dump("Catálogos da loja", catalogs)


async def catalog_reset(client: IFoodClient, merchant_id: str, state: dict[str, Any], dry_run: bool) -> None:
    """Apaga o item e a categoria de teste criados nos ensaios anteriores,
    e limpa o homologacao_state.json — pra gravar os vídeos oficiais do
    Catalog a partir de uma loja "limpa", sem reaproveitar nada."""
    if not state.get("category_id"):
        print("Nada pra limpar: não há category_id salvo em homologacao_state.json.")
        return

    if state.get("product_id"):
        print(f"Apagando item/produto {state['product_id']} da categoria {state['category_id']}...")
        try:
            await maybe_call(
                dry_run,
                "DELETE /categories/{categoryId}/products/{productId}",
                lambda: client.delete_item(merchant_id, state["category_id"], state["product_id"]),
            )
            print("  Item apagado.")
        except IFoodAPIError as error:
            print(f"  Não consegui apagar o item (pode já não existir): {error}")

    print(f"Apagando categoria {state['category_id']}...")
    try:
        await maybe_call(
            dry_run,
            "DELETE /categories/{categoryId}",
            lambda: client.delete_category(merchant_id, state["category_id"]),
        )
        print("  Categoria apagada.")
    except IFoodAPIError as error:
        print(f"  Não consegui apagar a categoria: {error}")

    if dry_run:
        print("\n[dry-run] homologacao_state.json NÃO foi limpo (nada foi apagado de verdade).")
    else:
        save_state({})
        print("\nhomologacao_state.json resetado. Pode gravar o Catalog do zero agora.")


# ---------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Roteiro guiado para gravar os cenários de homologação Merchant/Catalog pedidos pelo suporte iFood."
    )
    parser.add_argument("--merchant-id", required=True, help="merchantId (UUID) da loja de teste indicada pelo iFood.")
    parser.add_argument("--dry-run", action="store_true", help="Só mostra o JSON que seria enviado, sem chamar a API.")
    parser.add_argument("--no-pause", action="store_true", help="Não pausa entre passos (útil para --dry-run rápido).")

    sub = parser.add_subparsers(dest="cenario", required=True)

    sub.add_parser("merchant-1", help="Cenário 1 Merchant: informações da loja.")
    sub.add_parser("merchant-2", help="Cenário 2 Merchant: interrupção (pausa).")
    sub.add_parser("merchant-3", help="Cenário 3 Merchant: horário de funcionamento.")
    sub.add_parser("catalog-check", help="Diagnóstico: só lê GET /catalogs, sem criar nada.")

    catalog1 = sub.add_parser("catalog-1", help="Cenário 1 Catalog: categoria + item.")
    catalog1.add_argument("--item-photo", help="Caminho local da foto do item (jpg/png, <5MB).")

    catalog2 = sub.add_parser("catalog-2", help="Cenário 2 Catalog: grupo de complementos.")
    catalog2.add_argument("--complement-photo-1", help="Foto do complemento 1.")
    catalog2.add_argument("--complement-photo-2", help="Foto do complemento 2.")

    catalog3 = sub.add_parser("catalog-3", help="Cenário 3 Catalog: editar item e complementos.")
    catalog3.add_argument("--novo-nome-item", default="Produto Teste Editado")
    catalog3.add_argument("--novo-nome-complemento", default="Complemento 1 Editado")

    sub.add_parser(
        "limpar",
        help="Apaga a categoria/item de teste e reseta o homologacao_state.json (rodar antes de gravar de verdade).",
    )

    return parser


def print_banner(client: IFoodClient, merchant_id: str, cenario: str, dry_run: bool) -> None:
    agora = datetime.now().astimezone()
    print("=" * 70)
    print(f"HOMOLOGAÇÃO IFOOD — cenário: {cenario}")
    print(f"Data/hora da execução: {agora.strftime('%d/%m/%Y %H:%M:%S %z')}")
    print(f"client_id do aplicativo de teste: {client.client_id or '(não configurado)'}")
    print(f"merchantId: {merchant_id}")
    if dry_run:
        print("Modo: DRY-RUN (nenhuma chamada real será enviada)")
    print("=" * 70)


async def run() -> int:
    parser = build_parser()
    args = parser.parse_args()
    pausar = not args.no_pause
    client = IFoodClient()
    state = load_state()
    print_banner(client, args.merchant_id, args.cenario, args.dry_run)

    try:
        if args.cenario == "merchant-1":
            await cenario_merchant_1(client, args.merchant_id, pausar, args.dry_run)
        elif args.cenario == "merchant-2":
            await cenario_merchant_2(client, args.merchant_id, pausar, args.dry_run)
        elif args.cenario == "merchant-3":
            await cenario_merchant_3(client, args.merchant_id, pausar, args.dry_run)
        elif args.cenario == "catalog-check":
            await catalog_check(client, args.merchant_id)
        elif args.cenario == "catalog-1":
            await cenario_catalog_1(client, args.merchant_id, args.item_photo, pausar, args.dry_run, state)
        elif args.cenario == "catalog-2":
            await cenario_catalog_2(
                client, args.merchant_id, args.complement_photo_1, args.complement_photo_2, pausar, args.dry_run, state
            )
        elif args.cenario == "catalog-3":
            await cenario_catalog_3(
                client, args.merchant_id, pausar, args.dry_run, state, args.novo_nome_item, args.novo_nome_complemento
            )
        elif args.cenario == "limpar":
            await catalog_reset(client, args.merchant_id, state, args.dry_run)
        print("\nConcluído.")
        return 0
    except IFoodAPIError as error:
        print(f"\nO iFood recusou a chamada: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
