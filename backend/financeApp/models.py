import uuid
from decimal import Decimal

from django.db import models


class Transaction(models.Model):

    class EventType(models.TextChoices):
        CREDIT = "CREDIT", "Credit"
        DEBIT = "DEBIT", "Debit"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    event_details = models.TextField()

    event_type = models.CharField(
        max_length=6,
        choices=EventType.choices,
    )

    category = models.CharField(max_length=100)

    is_returnable = models.BooleanField(default=False)

    returnable_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
    )

    related_transactions = models.JSONField(
        default=list,
        blank=True,
    )

    transaction_at = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.event_type} - {self.amount}"
