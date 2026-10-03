from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.core.tenancy import IsOrganizationOwner, OrganizationScopedMixin

from .models import Organization
from .serializers import OrganizationSerializer, RegisterSerializer, UserSerializer


class AuthThrottle(AnonRateThrottle):
    scope = "auth"


def tokens_for(user) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class RegisterView(generics.CreateAPIView):
    """Création d'un compte gérant + organisation. Renvoie l'utilisateur et ses jetons."""

    authentication_classes: list = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthThrottle]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        payload = {"user": UserSerializer(user).data, **tokens_for(user)}
        return Response(payload, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    throttle_classes = [AuthThrottle]


class RefreshView(TokenRefreshView):
    pass


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class OrganizationViewSet(
    OrganizationScopedMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Organisations de l'utilisateur. Modification réservée au gérant."""

    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrganizationOwner]
    organization_lookup = ""
