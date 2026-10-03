from django.conf import settings
from django.db import connection
from django.http import FileResponse, Http404
from django.views import View
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Sonde de santé (Railway / supervision). Vérifie la base de données."""

    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return Response({"status": "ok"})


class SpaView(View):
    """Sert l'index.html du build Vite pour toutes les routes non-API."""

    def get(self, request, *args, **kwargs):
        index = settings.FRONTEND_DIST / "index.html"
        if not index.is_file():
            raise Http404
        return FileResponse(open(index, "rb"), content_type="text/html")
