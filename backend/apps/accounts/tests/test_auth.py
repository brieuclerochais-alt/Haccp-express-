import pytest
from django.urls import reverse

from apps.accounts.models import Membership, Organization, User

pytestmark = pytest.mark.django_db

REGISTER_PAYLOAD = {
    "email": "Marco@Pizzeria.fr",
    "password": "Pizza-Napoli-2026",
    "full_name": "Marco Rossi",
    "organization_name": "Pizzeria Da Marco",
}


def test_register_creates_user_organization_and_owner_membership(api_client):
    response = api_client.post(reverse("api:register"), REGISTER_PAYLOAD, format="json")

    assert response.status_code == 201, response.data
    assert response.data["access"] and response.data["refresh"]
    assert response.data["user"]["email"] == "marco@pizzeria.fr"

    user = User.objects.get(email="marco@pizzeria.fr")
    assert user.check_password(REGISTER_PAYLOAD["password"])
    organization = Organization.objects.get(name="Pizzeria Da Marco")
    membership = Membership.objects.get(user=user, organization=organization)
    assert membership.role == Membership.Role.OWNER
    assert response.data["user"]["memberships"][0]["organization"]["id"] == str(organization.id)
    assert response.data["user"]["memberships"][0]["role"] == "owner"


def test_register_rejects_duplicate_email(api_client):
    api_client.post(reverse("api:register"), REGISTER_PAYLOAD, format="json")
    response = api_client.post(reverse("api:register"), REGISTER_PAYLOAD, format="json")

    assert response.status_code == 400
    assert "email" in response.data
    assert User.objects.count() == 1
    assert Organization.objects.count() == 1


def test_register_rejects_weak_password(api_client):
    payload = {**REGISTER_PAYLOAD, "password": "1234"}
    response = api_client.post(reverse("api:register"), payload, format="json")

    assert response.status_code == 400
    assert "password" in response.data
    assert not User.objects.exists()


def test_login_returns_tokens_and_me_endpoint_works(api_client, make_owner):
    user, organization = make_owner(email="chef@brasserie.fr", password="Choucroute-Garnie-7")

    response = api_client.post(
        reverse("api:login"),
        {"email": "chef@brasserie.fr", "password": "Choucroute-Garnie-7"},
        format="json",
    )
    assert response.status_code == 200, response.data
    access = response.data["access"]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    me = api_client.get(reverse("api:me"))
    assert me.status_code == 200
    assert me.data["email"] == "chef@brasserie.fr"
    assert [m["organization"]["id"] for m in me.data["memberships"]] == [str(organization.id)]


def test_login_with_wrong_password_fails(api_client, make_owner):
    make_owner(email="chef@brasserie.fr", password="Choucroute-Garnie-7")

    response = api_client.post(
        reverse("api:login"),
        {"email": "chef@brasserie.fr", "password": "mauvais"},
        format="json",
    )
    assert response.status_code == 401


def test_refresh_token_returns_new_access(api_client, make_owner):
    make_owner(email="chef@brasserie.fr", password="Choucroute-Garnie-7")
    login = api_client.post(
        reverse("api:login"),
        {"email": "chef@brasserie.fr", "password": "Choucroute-Garnie-7"},
        format="json",
    )

    response = api_client.post(
        reverse("api:refresh"), {"refresh": login.data["refresh"]}, format="json"
    )
    assert response.status_code == 200
    assert response.data["access"]


def test_me_requires_authentication(api_client):
    response = api_client.get(reverse("api:me"))
    assert response.status_code == 401


def test_me_can_update_full_name_only(auth_client):
    client = auth_client()
    response = client.patch(
        reverse("api:me"), {"full_name": "Nouveau Nom", "email": "pirate@evil.com"}, format="json"
    )
    assert response.status_code == 200
    assert response.data["full_name"] == "Nouveau Nom"
    assert response.data["email"] != "pirate@evil.com"


def test_login_is_throttled(api_client, make_owner, settings):
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {"auth": "3/min"},
    }
    # Les réglages DRF sont mis en cache : on les recharge pour ce test.
    from rest_framework.settings import api_settings

    api_settings.reload()
    try:
        make_owner(email="chef@brasserie.fr", password="Choucroute-Garnie-7")
        payload = {"email": "chef@brasserie.fr", "password": "mauvais"}
        statuses = [
            api_client.post(reverse("api:login"), payload, format="json").status_code
            for _ in range(4)
        ]
        assert statuses[:3] == [401, 401, 401]
        assert statuses[3] == 429
    finally:
        api_settings.reload()
