import os

import pandas as pd
from sqlalchemy import create_engine, text

from core.resale_categories import RESALE_CATEGORIES


RESALE_COLUMN_ALIASES = {
    "pair_name": ["nom de la paire", "nom paire", "paire", "nom", "pair_name", "nom de l'objet", "objet"],
    "resale_category": ["categorie", "catégorie", "category", "type", "famille"],
    "purchase_price": [
        "prix d'achat",
        "prix achat",
        "purchase price",
        "buy price",
        "cout achat",
        "coût achat",
        "prix retail",
        "retail",
        "retail price",
        "prix retail €",
        "prix retail eur",
    ],
    "purchase_date": ["date d'achat", "purchase date", "date achat"],
    "purchase_site": ["site d'achat", "purchase site", "site achat", "shop achat"],
    "size": ["size", "taille"],
    "pair_received": ["paire reçu", "paire recue", "pair received", "recu", "reçu"],
    "sale_price": ["prix de vente", "sale price", "prix vente"],
    "sale_date": ["date de vente", "sale date", "date vente"],
    "sale_site": ["site de vente", "sale site", "site vente"],
    "pair_count": ["nb de paires", "nombre de paires", "qty", "quantite", "quantité", "nombre", "pair count"],
    "payment_method": ["mode de paiement", "paiement", "payment method", "moyen de paiement"],
    "benefit": ["benefice", "bénéfice", "profit", "marge"],
    "expected_price": ["prix attendu", "expected price", "target price", "prix cible"],
    "expected_benefit": ["benefice attendu", "bénéfice attendu", "profit attendu", "marge attendue"],
    "notes": ["notes", "commentaire", "commentaires", "note"],
}

RESALE_POSITIONAL_COLUMNS = [
    "pair_name",
    "resale_category",
    "purchase_price",
    "purchase_date",
    "purchase_site",
    "size",
    "pair_received",
    "sale_price",
    "sale_date",
    "sale_site",
    "pair_count",
    "payment_method",
    "benefit",
    "expected_price",
]


def _normalize_column_name(column_name: str) -> str:
    normalized = str(column_name).strip().lower()
    replacements = {
        "é": "e",
        "è": "e",
        "ê": "e",
        "à": "a",
        "ù": "u",
        "û": "u",
        "ô": "o",
        "î": "i",
        "ï": "i",
        "ç": "c",
        "'": " ",
        "_": " ",
        "-": " ",
        "/": " ",
        "(": " ",
        ")": " ",
    }
    for old, new in replacements.items():
        normalized = normalized.replace(old, new)
    return " ".join(normalized.split())


def _find_source_column(columns: list[str], aliases: list[str]) -> str | None:
    normalized_aliases = {_normalize_column_name(alias) for alias in aliases}
    for column in columns:
        if _normalize_column_name(column) in normalized_aliases:
            return column
    return None


def _coerce_numeric(series: pd.Series, default: float | None = None) -> pd.Series:
    cleaned = (
        series.astype(str)
        .str.replace("\u202f", "", regex=False)
        .str.replace(" ", "", regex=False)
        .str.replace("€", "", regex=False)
        .str.replace(",", ".", regex=False)
        .replace({"": None, "nan": None, "None": None})
    )
    numeric = pd.to_numeric(cleaned, errors="coerce")
    if default is not None:
        numeric = numeric.fillna(default)
    return numeric


def _coerce_boolean(series: pd.Series) -> pd.Series:
    truthy = {"true", "1", "yes", "oui", "ok", "x", "recu", "reçu"}
    falsy = {"false", "0", "no", "non", ""}
    normalized = series.astype(str).str.strip().str.lower().map(lambda value: _normalize_column_name(value))

    def parse_value(value: str) -> bool:
        if value in truthy:
            return True
        if value in falsy:
            return False
        return False

    return normalized.apply(parse_value)


def _load_raw_resale_file(file_path_or_buffer, extension: str, header_mode) -> pd.DataFrame:
    if hasattr(file_path_or_buffer, "seek"):
        file_path_or_buffer.seek(0)
    if extension == ".csv":
        return pd.read_csv(file_path_or_buffer, header=header_mode)
    return pd.read_excel(file_path_or_buffer, header=header_mode)


def _has_named_resale_columns(columns: list[str]) -> bool:
    matches = 0
    for aliases in RESALE_COLUMN_ALIASES.values():
        if _find_source_column(columns, aliases):
            matches += 1
    return matches >= 3


def _build_from_named_columns(raw_df: pd.DataFrame) -> pd.DataFrame:
    source_columns = list(raw_df.columns)
    cleaned = pd.DataFrame()

    for target_column, aliases in RESALE_COLUMN_ALIASES.items():
        source_column = _find_source_column(source_columns, aliases)
        if source_column is None:
            cleaned[target_column] = pd.NA
        else:
            cleaned[target_column] = raw_df[source_column]

    return cleaned


def _build_from_positional_columns(raw_df: pd.DataFrame) -> pd.DataFrame:
    raw_df = raw_df.copy()
    raw_df.columns = [f"col_{i}" for i in range(len(raw_df.columns))]
    cleaned = pd.DataFrame()

    for idx, target_column in enumerate(RESALE_POSITIONAL_COLUMNS):
        if idx < len(raw_df.columns):
            cleaned[target_column] = raw_df.iloc[:, idx]
        else:
            cleaned[target_column] = pd.NA

    if "purchase_price" not in cleaned.columns:
        cleaned["purchase_price"] = pd.NA
    if "expected_benefit" not in cleaned.columns:
        cleaned["expected_benefit"] = pd.NA
    if "notes" not in cleaned.columns:
        cleaned["notes"] = pd.NA

    return cleaned


def clean_resale_dataframe(file_path_or_buffer, file_name: str | None = None) -> pd.DataFrame:
    """Nettoie un export achat-revente et renvoie un DataFrame pret a l'insertion."""
    inferred_name = file_name or getattr(file_path_or_buffer, "name", "") or ""
    extension = os.path.splitext(inferred_name)[1].lower()

    raw_df = _load_raw_resale_file(file_path_or_buffer, extension, 0)
    raw_df = raw_df.dropna(how="all")

    if _has_named_resale_columns(list(raw_df.columns)):
        cleaned = _build_from_named_columns(raw_df)
    else:
        raw_df = _load_raw_resale_file(file_path_or_buffer, extension, None).dropna(how="all")
        cleaned = _build_from_positional_columns(raw_df)

    for optional_col in ["benefit", "expected_benefit", "notes"]:
        if optional_col not in cleaned.columns:
            cleaned[optional_col] = pd.NA
    if "resale_category" not in cleaned.columns:
        cleaned["resale_category"] = pd.NA

    cleaned["pair_name"] = cleaned["pair_name"].astype("string").str.strip()
    cleaned["resale_category"] = cleaned["resale_category"].astype("string").str.strip()
    cleaned["purchase_site"] = cleaned["purchase_site"].astype("string").str.strip()
    cleaned["sale_site"] = cleaned["sale_site"].astype("string").str.strip()
    cleaned["payment_method"] = cleaned["payment_method"].astype("string").str.strip()
    cleaned["size"] = cleaned["size"].astype("string").str.strip()
    cleaned["notes"] = cleaned["notes"].astype("string").str.strip()

    for date_col in ["purchase_date", "sale_date"]:
        cleaned[date_col] = pd.to_datetime(cleaned[date_col], dayfirst=True, errors="coerce")

    cleaned["purchase_price"] = _coerce_numeric(cleaned["purchase_price"], default=0.0)
    cleaned["sale_price"] = _coerce_numeric(cleaned["sale_price"])
    cleaned["expected_price"] = _coerce_numeric(cleaned["expected_price"])
    cleaned["benefit"] = _coerce_numeric(cleaned["benefit"])
    cleaned["expected_benefit"] = _coerce_numeric(cleaned["expected_benefit"])
    cleaned["pair_count"] = _coerce_numeric(cleaned["pair_count"], default=1).fillna(1).astype(int)
    cleaned["pair_count"] = cleaned["pair_count"].clip(lower=1)
    cleaned["pair_received"] = _coerce_boolean(cleaned["pair_received"].fillna(False))
    cleaned["resale_category"] = cleaned["resale_category"].where(cleaned["resale_category"].isin(RESALE_CATEGORIES), "Autres")

    missing_purchase_price = cleaned["purchase_price"].fillna(0.0) <= 0
    inferred_from_benefit = cleaned["sale_price"].notna() & cleaned["benefit"].notna()
    cleaned.loc[missing_purchase_price & inferred_from_benefit, "purchase_price"] = (
        cleaned.loc[missing_purchase_price & inferred_from_benefit, "sale_price"]
        - cleaned.loc[missing_purchase_price & inferred_from_benefit, "benefit"]
    )

    inferred_from_expected_benefit = cleaned["expected_price"].notna() & cleaned["expected_benefit"].notna()
    cleaned.loc[missing_purchase_price & inferred_from_expected_benefit, "purchase_price"] = (
        cleaned.loc[missing_purchase_price & inferred_from_expected_benefit, "expected_price"]
        - cleaned.loc[missing_purchase_price & inferred_from_expected_benefit, "expected_benefit"]
    )

    missing_pair_received = cleaned["pair_received"].eq(False)
    cleaned.loc[missing_pair_received & cleaned["sale_price"].fillna(0).gt(0), "pair_received"] = True

    cleaned = cleaned.dropna(subset=["pair_name"])
    cleaned = cleaned[cleaned["pair_name"].str.len() > 0]

    return cleaned.reset_index(drop=True)


def insert_resale_items(df: pd.DataFrame, db_url: str):
    """Insere un DataFrame achat-revente nettoye dans `resale_item`."""
    engine = create_engine(db_url)
    insert_query = text(
        """
        INSERT INTO resale_item (
            pair_name, resale_category, retail_price, purchase_price, purchase_date, purchase_site,
            size, pair_received, sale_price, sale_date, sale_site,
            pair_count, payment_method, expected_price, notes
        ) VALUES (
            :pair_name, :resale_category, :retail_price, :purchase_price, :purchase_date, :purchase_site,
            :size, :pair_received, :sale_price, :sale_date, :sale_site,
            :pair_count, :payment_method, :expected_price, :notes
        )
        """
    )

    with engine.begin() as conn:
        for _, row in df.iterrows():
            conn.execute(
                insert_query,
                {
                    "pair_name": row["pair_name"],
                    "resale_category": "Autres" if pd.isna(row["resale_category"]) else str(row["resale_category"]).strip() or "Autres",
                    "retail_price": None,
                    "purchase_price": 0.0 if pd.isna(row["purchase_price"]) else float(row["purchase_price"]),
                    "purchase_date": None if pd.isna(row["purchase_date"]) else pd.to_datetime(row["purchase_date"]).date(),
                    "purchase_site": None if pd.isna(row["purchase_site"]) or str(row["purchase_site"]).strip() == "" else str(row["purchase_site"]).strip(),
                    "size": None if pd.isna(row["size"]) or str(row["size"]).strip() == "" else str(row["size"]).strip(),
                    "pair_received": bool(row["pair_received"]),
                    "sale_price": None if pd.isna(row["sale_price"]) else float(row["sale_price"]),
                    "sale_date": None if pd.isna(row["sale_date"]) else pd.to_datetime(row["sale_date"]).date(),
                    "sale_site": None if pd.isna(row["sale_site"]) or str(row["sale_site"]).strip() == "" else str(row["sale_site"]).strip(),
                    "pair_count": int(row["pair_count"]) if not pd.isna(row["pair_count"]) else 1,
                    "payment_method": None if pd.isna(row["payment_method"]) or str(row["payment_method"]).strip() == "" else str(row["payment_method"]).strip(),
                    "expected_price": None if pd.isna(row["expected_price"]) else float(row["expected_price"]),
                    "notes": None if pd.isna(row["notes"]) or str(row["notes"]).strip() == "" else str(row["notes"]).strip(),
                },
            )
