from django.contrib import admin
from django.urls import path

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from financeApp import views


urlpatterns = [

    path("admin/", admin.site.urls),

    # Authentication
    path(
        "auth/token/",
        TokenObtainPairView.as_view(),
        name="token-obtain-pair",
    ),

    path(
        "auth/token/refresh/",
        TokenRefreshView.as_view(),
        name="token-refresh",
    ),

    # Transactions
    path(
        "transactions/",
        views.transactions,
        name="transactions",
    ),

    path(
        "transactions/<uuid:transaction_id>/",
        views.transaction_detail,
        name="transaction-detail",
    ),

    # Summary
    path(
        "summary/<int:year>/",
        views.summary,
        name="summary",
    ),

    # Categories
    path(
        "categories/",
        views.categories,
        name="categories",
    ),
]
