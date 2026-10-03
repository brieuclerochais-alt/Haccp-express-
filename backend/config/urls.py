from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.views import HealthView, SpaView

api_patterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("auth/", include("apps.accounts.urls")),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="api-docs"),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include((api_patterns, "api"))),
]

if settings.FRONTEND_DIST.is_dir():
    # Tout ce qui n'est ni l'API ni l'admin est rendu par la SPA (routage côté client).
    spa_pattern = r"^(?!api/|admin/|static/|media/).*$"
    urlpatterns.append(re_path(spa_pattern, SpaView.as_view(), name="spa"))
