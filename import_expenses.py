import pandas as pd
from sqlalchemy import create_engine, text
from datetime import datetime


def clean_expense_dataframe(file_path_or_buffer):
    """Nettoie le fichier Excel brut et renvoie un DataFrame prêt à l'insertion"""
    df = pd.read_excel(file_path_or_buffer, usecols=[0, 1, 2])
    df.columns = ['description_expense', 'price', 'expense_date']

    df['expense_date'] = pd.to_datetime(df['expense_date'], dayfirst=True, errors='coerce')
    df['price'] = df['price'].astype(str).str.replace(',', '.').astype(float)

    df = df.dropna(subset=['description_expense', 'price', 'expense_date'])
    return df


def insert_expenses(df, default_subcat_id, default_payment_id, db_url):
    """
    Insère un DataFrame de dépenses dans la base `expenses` avec SQLAlchemy
    - df : DataFrame nettoyé
    - default_subcat_id : ID entier de la sous-catégorie
    - default_payment_id : ID entier du moyen de paiement
    - db_url : URL SQLAlchemy (ex: postgresql+psycopg2://user:pass@host/db)
    """
    engine = create_engine(db_url)

    insert_query = text("""
        INSERT INTO expenses (
            description_expense, price, expense_date, subcategory_id, payment_method_id
        ) VALUES (
            :description_expense, :price, :expense_date, :subcategory_id, :payment_method_id
        )
    """)

    with engine.begin() as conn:
        for _, row in df.iterrows():
            conn.execute(insert_query, {
                'description_expense': row['description_expense'],
                'price': row['price'],
                'expense_date': row['expense_date'],
                'subcategory_id': default_subcat_id,
                'payment_method_id': default_payment_id
            })
