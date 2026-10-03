import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Membership, Organization, User


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def make_owner(db):
    """Crée un gérant avec son organisation. Retourne (user, organization)."""

    counter = {"n": 0}

    def _make(
        email: str | None = None,
        org_name: str | None = None,
        password: str = "MotDePasse-123!",
    ):
        counter["n"] += 1
        email = email or f"gerant{counter['n']}@example.com"
        user = User.objects.create_user(
            email=email, password=password, full_name=f"Gérant {counter['n']}"
        )
        organization = Organization.objects.create(name=org_name or f"Resto {counter['n']}")
        Membership.objects.create(user=user, organization=organization, role=Membership.Role.OWNER)
        return user, organization

    return _make


@pytest.fixture
def auth_client(api_client, make_owner):
    """Client authentifié (JWT) pour un gérant fraîchement créé."""

    def _auth(user=None):
        if user is None:
            user, _ = make_owner()
        api_client.force_authenticate(user=user)
        return api_client

    return _auth
