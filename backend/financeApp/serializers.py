from rest_framework import serializers

from .models import Transaction


class TransactionSerializer(serializers.ModelSerializer):

    class Meta:
        model = Transaction
        fields = [
            "id",
            "amount",
            "event_details",
            "event_type",
            "category",
            "is_returnable",
            "returnable_amount",
            "related_transactions",
            "transaction_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]