"""
Isolation multi-tenant.

Chaque requête API est filtrée par les organisations dont l'utilisateur est
membre. Les vues héritent de `OrganizationScopedMixin` et déclarent le chemin
ORM qui mène à l'organisation (`organization_lookup`). Toute ressource
d'une autre organisation est invisible (404), jamais interdite (403), afin de
ne pas révéler son existence.
"""

from __future__ import annotations

from django.db.models import QuerySet
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import Membership, Organization


def organizations_for(user) -> QuerySet[Organization]:
    """Organisations auxquelles `user` appartient (vide si anonyme)."""
    if user is None or not user.is_authenticated:
        return Organization.objects.none()
    return Organization.objects.filter(memberships__user=user).distinct()


def membership_for(user, organization: Organization) -> Membership | None:
    if user is None or not user.is_authenticated:
        return None
    return Membership.objects.filter(user=user, organization=organization).first()


class OrganizationScopedMixin:
    """
    Restreint `get_queryset()` aux lignes rattachées à une organisation de
    l'utilisateur courant.

    `organization_lookup` est le chemin ORM depuis le modèle vers le champ
    `organization` (ex. "establishment__organization"). Vide pour le modèle
    `Organization` lui-même.
    """

    organization_lookup: str = "organization"

    def get_queryset(self):  # type: ignore[override]
        queryset = super().get_queryset()  # type: ignore[misc]
        return scope_to_user(queryset, self.request.user, self.organization_lookup)

    def check_organization_access(self, organization: Organization) -> Membership:
        """À appeler à la création : vérifie que l'organisation cible est bien la sienne."""
        membership = membership_for(self.request.user, organization)
        if membership is None:
            raise PermissionDenied("Organisation inaccessible.")
        return membership


def scope_to_user(queryset: QuerySet, user, organization_lookup: str = "organization") -> QuerySet:
    if user is None or not user.is_authenticated:
        return queryset.none()
    organizations = organizations_for(user)
    if organization_lookup:
        return queryset.filter(**{f"{organization_lookup}__in": organizations})
    return queryset.filter(pk__in=organizations.values("pk"))


class IsOrganizationOwner(permissions.BasePermission):
    """Seul un gérant (owner) peut modifier l'objet (facturation, abonnement…)."""

    message = "Réservé au gérant de l'organisation."

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return True
        organization = obj if isinstance(obj, Organization) else getattr(obj, "organization", None)
        if organization is None:
            return False
        membership = membership_for(request.user, organization)
        return membership is not None and membership.role == Membership.Role.OWNER
