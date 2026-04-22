# My Fin Apps

Application Streamlit pour suivre:

- les depenses et revenus
- les limites budgétaires
- les abonnements
- le cashflow
- les investissements en bourse et crypto
- l'achat-revente
- les objets de patrimoine

## Installation

```bash
pip install -r requirements.txt
```

## Base de donnees

Le schema complet est dans `init.sql`.

Exemple:

```bash
psql -U postgres -d postgres -f init.sql
```

Tu peux aussi surcharger la connexion en definissant `MY_FIN_APPS_DB_URL`.

Exemple:

```bash
export MY_FIN_APPS_DB_URL="postgresql+psycopg2://postgres:admin@localhost/postgres"
```

## Lancer l'application

```bash
streamlit run app.py
```

## Valorisation des actions / ETF / crypto

Pour suivre les dernieres valeurs:

- cree un actif avec un `ticker`
- active un type d'actif cote comme `Action`, `ETF` ou `Crypto`
- dans la page `Patrimoine`, utilise le bouton de mise a jour automatique

Exemples de tickers:

- `MC.PA` pour LVMH
- `CW8.PA` pour un ETF cote a Paris
- `BTC-EUR` pour Bitcoin en euros

Les objets de patrimoine et l'achat-revente peuvent aussi etre suivis avec des valorisations manuelles.
