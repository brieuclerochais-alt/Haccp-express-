"""
Modèles abstraits communs.

Tous les modèles métier héritent de `UUIDTimeStampedModel` : identifiant UUID
(généré côté client pour les enregistrements terrain, cf. cahier des charges §3)
et horodatage de création / mise à jour.
"""

import uuid

from django.db import models


class UUIDTimeStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]
