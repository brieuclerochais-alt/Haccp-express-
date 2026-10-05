# HACCP Express

Application SaaS qui digitalise le Plan de Maîtrise Sanitaire (PMS) des restaurants
indépendants. « 5 minutes par jour, et vous êtes prêt pour le contrôle DDPP. »

- Cahier des charges : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md)
- Questions ouvertes : [`QUESTIONS.md`](QUESTIONS.md)
- Avancement : **Lot 0 — Socle** ✅ (voir § Lots ci-dessous)

## Stack

| Couche    | Choix                                                                   |
| --------- | ----------------------------------------------------------------------- |
| Backend   | Django 5.2 + Django REST Framework, Python 3.12, PostgreSQL 16, uv       |
| Frontend  | React 19 + Vite 7 + TypeScript, Tailwind 4, composants shadcn/ui, PWA    |
| Tests     | pytest + pytest-django · Vitest + Testing Library · Playwright           |
| Déploiement | Docker (image unique : Django sert le build Vite via WhiteNoise), Railway |

## Démarrage rapide

Prérequis : Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 22, PostgreSQL 16
(ou Docker).

```bash
# Tout-en-un avec Docker
docker compose up
# → API http://localhost:8000/api/ · Front http://localhost:5173 · Swagger /api/docs/

# Ou en local
make install
createdb haccp_express            # ou DATABASE_URL=... dans backend/.env
make migrate
make dev-backend                  # terminal 1 — http://localhost:8000
make dev-frontend                 # terminal 2 — http://localhost:5173 (proxy /api → 8000)
```

Variables d'environnement : voir [`backend/.env.example`](backend/.env.example).

## Tests

```bash
make test            # pytest + vitest
make e2e             # build + Playwright (mobile et tablette)
make lint            # ruff + eslint
```

Si Playwright ne trouve pas de navigateur :
`npx playwright install chromium`, ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/chemin/vers/chromium`.

## Architecture

```
backend/
  config/            réglages (settings.py, settings_test.py), urls, wsgi
  apps/core/         modèle de base UUID + horodatage, tenancy (isolation), santé, SPA
  apps/accounts/     User (email), Organization (tenant), Membership (owner/manager), auth JWT
frontend/
  src/lib/api.ts     client HTTP, jetons, rafraîchissement, erreurs DRF
  src/lib/auth.tsx   contexte d'authentification gérant
  src/pages/         Connexion, Inscription, Aujourd'hui (squelette)
  src/components/ui  Button, Input, Label, Card (zones tactiles ≥ 56 px)
  e2e/               parcours critiques Playwright (API simulée au Lot 0)
```

### Multi-tenant

Chaque ligne métier est rattachée à une `Organization`. Les vues héritent de
`OrganizationScopedMixin` (`apps/core/tenancy.py`) qui restreint `get_queryset()` aux
organisations de l'utilisateur. Une ressource d'une autre organisation renvoie **404**
(jamais 403). Les tests d'isolation sont dans
`apps/accounts/tests/test_tenant_isolation.py` et doivent être étendus à chaque
nouveau modèle.

### API (Lot 0)

| Méthode | Route                        | Rôle                                   |
| ------- | ---------------------------- | -------------------------------------- |
| GET     | `/api/health/`               | Sonde de santé                         |
| POST    | `/api/auth/register/`        | Inscription gérant + organisation      |
| POST    | `/api/auth/login/`           | Connexion (JWT)                        |
| POST    | `/api/auth/refresh/`         | Rafraîchissement du jeton              |
| GET/PATCH | `/api/auth/me/`            | Profil courant                         |
| GET/PATCH | `/api/auth/organizations/` | Organisations (modification : owner)   |
| GET     | `/api/docs/`                 | Swagger (schéma OpenAPI)               |

## Déploiement (Railway, staging)

1. Créer un projet Railway en région UE (`europe-west4`).
2. **Ajouter une base PostgreSQL** au projet : « + New » → « Database » → « PostgreSQL ».
3. Créer un service depuis ce dépôt : `railway.toml` pointe sur `backend/Dockerfile`.
4. Dans l'onglet « Variables » du service web, ajouter :

   | Variable                       | Valeur                                                        |
   | ------------------------------ | ------------------------------------------------------------- |
   | `DATABASE_URL`                 | `${{Postgres.DATABASE_URL}}` (référence vers le plugin)       |
   | `DJANGO_SECRET_KEY`            | une chaîne aléatoire longue (`openssl rand -hex 32`)          |
   | `DJANGO_ALLOWED_HOSTS`         | le domaine Railway, ex. `haccp-express.up.railway.app`        |
   | `DJANGO_CSRF_TRUSTED_ORIGINS`  | `https://haccp-express.up.railway.app`                        |
   | `CORS_ALLOWED_ORIGINS`         | `https://haccp-express.up.railway.app`                        |

   Sans `DATABASE_URL`, le conteneur s'arrête au démarrage avec un message explicite
   (il tenterait sinon de joindre un Postgres sur `localhost`).
5. Redéployer. L'image exécute `migrate` au démarrage puis `gunicorn`.
   Healthcheck : `/api/health/`.

## Lots

| Lot | Contenu                                                    | État |
| --- | ---------------------------------------------------------- | ---- |
| 0   | Socle : Django/DRF, React/Vite, PWA, Docker, CI, multi-tenant, auth gérant | ✅ |
| 1   | Structure et onboarding, équipe + PIN, appairage           | ⏳   |
| 2   | « Aujourd'hui », températures, nettoyage, non-conformités  |      |
| 3   | Mode hors ligne                                            |      |
| 4   | Réception, traçabilité, DLC secondaires                    |      |
| 5   | Refroidissement, remise en température, huiles             |      |
| 6   | Documents PMS, historique, tableau de bord, rapport DDPP   |      |
| 7   | Abonnement, emails, mise en production                     |      |
