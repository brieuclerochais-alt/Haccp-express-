"""
Comptes gérants / responsables et organisations (tenants).

- `Organization` : le tenant. Toute donnée métier s'y rattache (directement ou
  via un établissement).
- `User` : gérant ou responsable, identifié par email.
- `Membership` : rôle d'un utilisateur dans une organisation.

Les employés (StaffMember, PIN) arrivent au Lot 1.
"""

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.core.models import UUIDTimeStampedModel


class Organization(UUIDTimeStampedModel):
    name = models.CharField("nom", max_length=200)
    siret = models.CharField("SIRET", max_length=14, blank=True)
    billing_address = models.TextField("adresse de facturation", blank=True)
    stripe_customer_id = models.CharField(max_length=64, blank=True)

    class Meta(UUIDTimeStampedModel.Meta):
        verbose_name = "organisation"

    def __str__(self) -> str:
        return self.name


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("L'adresse email est obligatoire.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, UUIDTimeStampedModel):
    email = models.EmailField("email", unique=True)
    full_name = models.CharField("nom complet", max_length=150, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField("accès admin Django", default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta(UUIDTimeStampedModel.Meta):
        verbose_name = "utilisateur"

    def __str__(self) -> str:
        return self.email

    @property
    def organizations(self):
        return Organization.objects.filter(memberships__user=self).distinct()


class Membership(UUIDTimeStampedModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Gérant"
        MANAGER = "manager", "Responsable"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MANAGER)

    class Meta(UUIDTimeStampedModel.Meta):
        verbose_name = "appartenance"
        constraints = [
            models.UniqueConstraint(fields=["user", "organization"], name="unique_membership")
        ]

    def __str__(self) -> str:
        return f"{self.user} · {self.organization} ({self.get_role_display()})"
