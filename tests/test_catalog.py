import csv
import io

from backend.catalog import items_to_csv, normalize_categories


def test_normaliza_itens_ativos_e_pausados():
    categories = [
        {
            "name": "Pizzas",
            "items": [
                {
                    "status": "AVAILABLE",
                    "price": {"value": 39.9},
                    "products": [{"name": "Margherita"}],
                },
                {
                    "status": "UNAVAILABLE",
                    "price": {"value": 42},
                    "products": [{"name": "Calabresa"}],
                },
            ],
        }
    ]

    rows = normalize_categories(categories, "Ital Centro")

    assert rows[0]["rowsName"] == "Margherita"
    assert rows[0]["status"] == "Ativo"
    assert rows[0]["priceValue"] == "39,90"
    assert rows[1]["status"] == "Pausado"


def test_csv_preserva_virgulas_e_acentos():
    rows = [
        {
            "lojasSimpleName": "Ital Centro",
            "categoriesName": "Pizzas",
            "rowsName": "Pizza, queijo",
            "data": "2026-07-28",
            "status": "Ativo",
            "priceValue": "39,90",
        }
    ]

    parsed = list(csv.DictReader(io.StringIO(items_to_csv(rows))))

    assert parsed == rows
