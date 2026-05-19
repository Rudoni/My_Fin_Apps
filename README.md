# My Fin Apps

App perso de pilotage financier avec :

- un dashboard global
- un module dépenses / revenus
- un module achat-revente unitaire
- un module stock brocante / binder
- un module patrimoine

La stack principale est maintenant :

- `frontend/` : React + Vite
- `backend/` : FastAPI
- `PostgreSQL` : base unique partagée
- `Alembic` : migrations versionnées

Le repo est maintenant centré sur la stack React + FastAPI.

## Lancement rapide

### 1. Initialiser la base

Le schéma est dans [init.sql](/Users/rudoniantonin/Documents/Projet%20Perso/My_Fin_Apps/init.sql).

Commande type :

```bash
psql "$MY_FIN_APPS_DB_URL" -f init.sql
```

Le script est pensé pour être relancé sans casser les données déjà présentes : il crée ce qui manque et applique les évolutions nécessaires.

Pour les prochaines évolutions, le projet a aussi maintenant un socle Alembic. La logique conseillée est :

- `init.sql` pour initialiser une nouvelle base
- `alembic upgrade head` pour les évolutions suivantes

Commande :

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
```

### 2. Préparer la configuration

Copie `.env.example` vers `.env` puis remplace les valeurs :

```bash
cp .env.example .env
```

Variables principales :

```bash
MY_FIN_APPS_DB_URL=postgresql://postgres:change-me@localhost/postgres
# Optionnel
MY_FIN_APPS_API_KEY=change-me-long-random-string
MY_FIN_APPS_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
MY_FIN_APPS_MAX_UPLOAD_SIZE_MB=5
VITE_API_BASE_URL=http://localhost:8000/api
# Optionnel
VITE_API_KEY=change-me-long-random-string
```

### 3. Lancer le backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend local :

```text
http://localhost:8000
```

Docs Swagger :

```text
http://localhost:8000/docs
```

### 4. Lancer le frontend

Dans un autre terminal :

```bash
cd frontend
npm install
npm run dev
```

Frontend local :

```text
http://localhost:5173
```

## Configuration

Le backend lit :

- `MY_FIN_APPS_DB_URL` puis `DATABASE_URL`
- `MY_FIN_APPS_API_KEY`
- `MY_FIN_APPS_CORS_ORIGINS`
- `MY_FIN_APPS_MAX_UPLOAD_SIZE_MB`

Le frontend lit :

- `VITE_API_BASE_URL`
- `VITE_API_KEY`

Le login multi-user suffit pour l'usage normal. La clé API reste seulement une couche optionnelle si tu veux rajouter un verrou partagé en plus.

## Exploitation

Quelques commandes utiles :

```bash
make init-db
make alembic-upgrade
make backup-db
```

Le backup crée un snapshot dans `backups/` au format `.dump`.

## Déploiement

Pour un déploiement simple et peu cher pour toi et quelques potes, la reco actuelle est :

- frontend sur Vercel
- backend sur Railway
- base sur Neon

Le guide pas à pas est dans [deployment-cheap.md](/Users/rudoniantonin/Documents/Projet%20Perso/My_Fin_Apps/docs/deployment-cheap.md).

## Organisation produit

### Dashboard

Vue globale avec :

- patrimoine total
- revenus
- dépenses
- cashflow
- CA achat-revente
- bénéfice revente
- stock estimé

### Dépenses

Pour suivre :

- revenus
- dépenses
- cashflow
- dépenses par mois
- dépenses par catégorie

### Achat-revente

Pour les pièces unitaires :

- achats
- ventes
- bénéfices
- P/L latente
- filtres par année
- catégories

### Stock brocante

Pour le stock agrégé :

- références en quantité
- prix moyen d'achat
- ventes par lot
- stock restant
- binder / top loader séparé
- catégories personnalisables

### Patrimoine

Pour suivre :

- cash
- actions
- ETF
- crypto
- actifs physiques
- stock brocante et revente intégré au patrimoine global

## Tickers Yahoo utiles

Exemples :

- `AI.PA` : Air Liquide
- `MC.PA` : LVMH
- `BTC-EUR` : Bitcoin en euro
- `ETH-EUR` : Ethereum en euro

Conseil pratique :

- pour les actifs européens, privilégie les tickers en euro quand c'est possible
- pour les ETF PEA, vérifie toujours le ticker exact ou l'ISIN du produit

## Scripts utiles

En complément de l'app :

- [import_expenses.py](/Users/rudoniantonin/Documents/Projet%20Perso/My_Fin_Apps/import_expenses.py) pour nettoyer / insérer des dépenses
- [import_resale.py](/Users/rudoniantonin/Documents/Projet%20Perso/My_Fin_Apps/import_resale.py) pour nettoyer / insérer de l'achat-revente
