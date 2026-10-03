.PHONY: install dev-backend dev-frontend test test-backend test-frontend e2e lint migrate

install:
	cd backend && uv sync
	cd frontend && npm ci

dev-backend:
	cd backend && DJANGO_DEBUG=true uv run python manage.py runserver

dev-frontend:
	cd frontend && npm run dev

migrate:
	cd backend && uv run python manage.py migrate

test: test-backend test-frontend

test-backend:
	cd backend && uv run pytest

test-frontend:
	cd frontend && npm run typecheck && npm test

e2e:
	cd frontend && npm run build && npx playwright test

lint:
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && npm run lint
