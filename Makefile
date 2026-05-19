DB_URL ?= $(MY_FIN_APPS_DB_URL)

.PHONY: backend frontend init-db alembic-upgrade alembic-revision backup-db restore-db

backend:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload

frontend:
	cd frontend && npm run dev

init-db:
	psql "$(DB_URL)" -f init.sql

alembic-upgrade:
	cd backend && . .venv/bin/activate && alembic upgrade head

alembic-revision:
	cd backend && . .venv/bin/activate && alembic revision -m "$(m)"

backup-db:
	mkdir -p backups
	pg_dump -Fc "$(DB_URL)" > backups/my_fin_apps_$$(date +%Y-%m-%d_%H-%M-%S).dump

restore-db:
	pg_restore -d "$(DB_URL)" "$(file)"
