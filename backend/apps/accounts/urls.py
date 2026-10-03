from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import LoginView, MeView, OrganizationViewSet, RefreshView, RegisterView

router = DefaultRouter()
router.register("organizations", OrganizationViewSet, basename="organization")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
