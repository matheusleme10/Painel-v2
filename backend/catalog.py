from __future__ import annotations

import csv
import io
from datetime import date
from typing import Any

CSV_HEADERS = ["lojasSimpleName", "categoriesName", "rowsName", "data", "status", "priceValue"]


def _default_modifier(item: dict[str, Any]) -> dict[str, Any]:
    return next(
        (m for m in item.get("contextModifiers", []) if m.get("catalogContext") == "DEFAULT"),
        {},
    )


def _name(item: dict[str, Any]) -> str:
    products = item.get("products") or []
    return (
        item.get("name")
        or (item.get("product") or {}).get("name")
        or (products[0].get("name") if products else None)
        or item.get("itemName")
        or "Item sem nome"
    )


def _price(item: dict[str, Any]) -> str:
    modifier_price = (_default_modifier(item).get("price") or {}).get("value")
    item_price = item.get("price", {})
    raw = modifier_price if modifier_price is not None else (
        item_price.get("value", 0) if isinstance(item_price, dict) else item_price
    )
    try:
        return f"{float(raw):.2f}".replace(".", ",")
    except (TypeError, ValueError):
        return "0,00"


def _status(item: dict[str, Any]) -> str:
    status = _default_modifier(item).get("status") or item.get("status")
    active = status in {"AVAILABLE", "ACTIVE"} or item.get("available") is True
    return "Ativo" if active else "Pausado"


def normalize_categories(categories: list[dict[str, Any]], merchant_name: str) -> list[dict[str, str]]:
    today = date.today().isoformat()
    return [
        {
            "lojasSimpleName": merchant_name,
            "categoriesName": category.get("name") or "Sem categoria",
            "rowsName": _name(item),
            "data": today,
            "status": _status(item),
            "priceValue": _price(item),
        }
        for category in categories
        for item in category.get("items", [])
    ]


def items_to_csv(items: list[dict[str, str]]) -> str:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=CSV_HEADERS)
    writer.writeheader()
    writer.writerows(items)
    return output.getvalue()
