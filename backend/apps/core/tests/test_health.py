import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db


def test_health_is_public(api_client):
    response = api_client.get(reverse("api:health"))
    assert response.status_code == 200
    assert response.data == {"status": "ok"}


def test_openapi_schema_is_generated(auth_client):
    response = auth_client().get(reverse("api:schema"))
    assert response.status_code == 200
    assert b"/api/auth/register/" in response.content
