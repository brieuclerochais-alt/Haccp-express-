"""
Tests d'isolation multi-tenant (cahier des charges §1 et §11).

Un utilisateur ne voit jamais les données d'une autre organisation : la
ressource est introuvable (404), pas interdite (403), pour ne pas révéler son
existence.
"""

import pytest
from django.urls import reverse

from apps.accounts.models import Membership, Organization
from apps.core.tenancy import organizations_for, scope_to_user

pytestmark = pytest.mark.django_db


def test_user_only_lists_own_organizations(api_client, make_owner):
    user_a, org_a = make_owner(org_name="Pizzeria A")
    make_owner(org_name="Brasserie B")

    api_client.force_authenticate(user=user_a)
    response = api_client.get(reverse("api:organization-list"))

    assert response.status_code == 200
    assert [o["id"] for o in response.data["results"]] == [str(org_a.id)]


def test_user_cannot_retrieve_another_organization(api_client, make_owner):
    user_a, _ = make_owner()
    _, org_b = make_owner()

    api_client.force_authenticate(user=user_a)
    response = api_client.get(reverse("api:organization-detail", args=[org_b.id]))

    assert response.status_code == 404


def test_user_cannot_update_another_organization(api_client, make_owner):
    user_a, _ = make_owner()
    _, org_b = make_owner(org_name="Brasserie B")

    api_client.force_authenticate(user=user_a)
    response = api_client.patch(
        reverse("api:organization-detail", args=[org_b.id]), {"name": "Piratée"}, format="json"
    )

    assert response.status_code == 404
    org_b.refresh_from_db()
    assert org_b.name == "Brasserie B"


def test_owner_can_update_own_organization(api_client, make_owner):
    user_a, org_a = make_owner()

    api_client.force_authenticate(user=user_a)
    response = api_client.patch(
        reverse("api:organization-detail", args=[org_a.id]),
        {"name": "Pizzeria Renommée", "siret": "12345678901234"},
        format="json",
    )

    assert response.status_code == 200
    org_a.refresh_from_db()
    assert org_a.name == "Pizzeria Renommée"
    assert org_a.siret == "12345678901234"


def test_manager_can_read_but_not_update_organization(api_client, make_owner):
    _, org = make_owner()
    manager, _ = make_owner()
    Membership.objects.create(user=manager, organization=org, role=Membership.Role.MANAGER)

    api_client.force_authenticate(user=manager)
    read = api_client.get(reverse("api:organization-detail", args=[org.id]))
    assert read.status_code == 200

    update = api_client.patch(
        reverse("api:organization-detail", args=[org.id]), {"name": "X"}, format="json"
    )
    assert update.status_code == 403


def test_anonymous_cannot_list_organizations(api_client, make_owner):
    make_owner()
    response = api_client.get(reverse("api:organization-list"))
    assert response.status_code == 401


def test_scope_helpers_filter_by_membership(make_owner):
    user_a, org_a = make_owner()
    _, org_b = make_owner()

    assert list(organizations_for(user_a)) == [org_a]
    scoped = scope_to_user(Organization.objects.all(), user_a, organization_lookup="")
    assert list(scoped) == [org_a]
    assert org_b not in scoped


def test_scope_helpers_return_nothing_for_anonymous(make_owner):
    from django.contrib.auth.models import AnonymousUser

    make_owner()
    assert not organizations_for(AnonymousUser()).exists()
    assert not organizations_for(None).exists()
    assert not scope_to_user(Organization.objects.all(), AnonymousUser(), "").exists()
