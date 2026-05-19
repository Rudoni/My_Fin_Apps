# Deployment Cheap

Objectif : une version simple, fiable et peu chere pour toi et quelques potes.

## Stack recommandee

- `frontend` sur Vercel
- `backend` sur Railway
- `database` sur Neon Postgres

Pourquoi ce choix :

- Vercel est tres simple pour un front Vite
- Railway est pratique pour un petit backend FastAPI sans trop d'ops
- Neon a un plan gratuit confortable pour commencer et des sauvegardes / restore utiles

## Variables d'environnement backend

Sur Railway :

```bash
MY_FIN_APPS_DB_URL=postgresql://...
MY_FIN_APPS_CORS_ORIGINS=https://ton-front.vercel.app
MY_FIN_APPS_MAX_UPLOAD_SIZE_MB=5
```

Optionnel :

```bash
MY_FIN_APPS_API_KEY=
```

## Variables d'environnement frontend

Sur Vercel :

```bash
VITE_API_BASE_URL=https://ton-backend.railway.app/api
VITE_API_KEY=
```

## Deploiement backend

1. Cree un projet Railway
2. Selectionne le dossier `backend/`
3. Railway detectera le `Dockerfile`
4. Ajoute les variables d'environnement
5. Lance le deploy

Healthcheck utile :

```text
GET /health
```

## Deploiement base

1. Cree un projet Neon
2. Recupere l'URL Postgres
3. Initialise d'abord la base :

```bash
make init-db
```

4. Puis applique les migrations versionnees :

```bash
make alembic-upgrade
```

## Deploiement frontend

1. Cree un projet Vercel
2. Selectionne le dossier `frontend/`
3. Ajoute `VITE_API_BASE_URL`
4. Build command :

```bash
npm run build
```

5. Output directory :

```bash
dist
```

## Checklist avant d'inviter tes potes

- premier compte cree et anciennes donnees rattachees
- au moins un backup DB
- URL backend accessible
- CORS pointe bien vers le front Vercel
- login / register / dashboard testes avec un 2e compte

## Mode zero-cout / quasi-local

Si tu ne veux pas deployer tout de suite :

- garde Postgres en local
- utilise `make backup-db`
- stocke les dumps dans un cloud perso ou un disque externe

Ca reste une bonne strategie tant que vous etes peu nombreux.
