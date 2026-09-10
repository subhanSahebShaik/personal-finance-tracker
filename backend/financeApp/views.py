from django.db.models import Sum
from django.db import transaction as db_transaction
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Transaction
from .serializers import TransactionSerializer


@api_view(["GET", "POST"])
def transactions(request):

    if request.method == "GET":

        queryset = Transaction.objects.all()

        year = request.GET.get("year")
        month = request.GET.get("month")

        if year:
            queryset = queryset.filter(transaction_at__year=year)

        if month:
            queryset = queryset.filter(transaction_at__month=month)

        queryset = queryset.order_by("-transaction_at")

        serializer = TransactionSerializer(queryset, many=True,)

        return Response({"transactions": serializer.data})

    serializer = TransactionSerializer(data=request.data)

    if serializer.is_valid():
        transaction = serializer.save()

        return Response(
            TransactionSerializer(transaction).data,
            status=status.HTTP_201_CREATED,
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["GET", "PATCH", "DELETE"])
def transaction_detail(request, transaction_id):

    try:
        transaction = Transaction.objects.get(id=transaction_id)
    except Transaction.DoesNotExist:
        return Response(
            {"detail": "Transaction not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    # ---------------------------------------------------------
    # GET
    # ---------------------------------------------------------

    if request.method == "GET":

        serializer = TransactionSerializer(transaction)

        return Response(serializer.data)

    # ---------------------------------------------------------
    # PATCH
    # ---------------------------------------------------------

    if request.method == "PATCH":

        with db_transaction.atomic():

            old_related = set(
                str(item)
                for item in (transaction.related_transactions or [])
            )

            serializer = TransactionSerializer(
                transaction,
                data=request.data,
                partial=True,
            )

            if not serializer.is_valid():
                return Response(
                    serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST,
                )

            updated_transaction = serializer.save()

            new_related = set(
                str(item)
                for item in (
                    updated_transaction.related_transactions or []
                )
            )

            added = new_related - old_related
            removed = old_related - new_related

            transaction_id_str = str(updated_transaction.id)

            # -------------------------------------------------
            # Validate ALL newly related transactions first
            # -------------------------------------------------

            related_objects = {}

            for related_id in added:

                try:
                    related = Transaction.objects.get(id=related_id)
                except Transaction.DoesNotExist:

                    return Response(
                        {
                            "detail": (
                                f"Related transaction "
                                f"{related_id} not found."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Prevent a transaction from relating to itself.
                if str(related.id) == transaction_id_str:
                    return Response(
                        {
                            "detail": (
                                "A transaction cannot be related "
                                "to itself."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                related_objects[related_id] = related

            # -------------------------------------------------
            # Add reverse relationships
            # -------------------------------------------------

            for related_id, related in related_objects.items():

                related_ids = [
                    str(item)
                    for item in (related.related_transactions or [])
                ]

                if transaction_id_str not in related_ids:
                    related_ids.append(transaction_id_str)

                    related.related_transactions = related_ids

                    related.save(
                        update_fields=[
                            "related_transactions",
                            "updated_at",
                        ]
                    )

            # -------------------------------------------------
            # Remove reverse relationships
            # -------------------------------------------------

            for related_id in removed:

                try:
                    related = Transaction.objects.get(id=related_id)
                except Transaction.DoesNotExist:
                    continue

                related_ids = [
                    str(item)
                    for item in (related.related_transactions or [])
                ]

                if transaction_id_str in related_ids:

                    related_ids.remove(transaction_id_str)

                    related.related_transactions = related_ids

                    related.save(
                        update_fields=[
                            "related_transactions",
                            "updated_at",
                        ]
                    )

            return Response(
                TransactionSerializer(updated_transaction).data
            )

    # ---------------------------------------------------------
    # DELETE
    # ---------------------------------------------------------

    if request.method == "DELETE":

        with db_transaction.atomic():

            transaction_id_str = str(transaction.id)

            related_ids = [
                str(item)
                for item in (transaction.related_transactions or [])
            ]

            # Remove this transaction from every related record.
            for related_id in related_ids:

                try:
                    related = Transaction.objects.get(id=related_id)
                except Transaction.DoesNotExist:
                    continue

                ids = [
                    str(item)
                    for item in (related.related_transactions or [])
                ]

                if transaction_id_str in ids:

                    ids.remove(transaction_id_str)

                    related.related_transactions = ids

                    related.save(
                        update_fields=[
                            "related_transactions",
                            "updated_at",
                        ]
                    )

            transaction.delete()

        return Response({"success": True}, status=status.HTTP_200_OK)


@api_view(["GET"])
def summary(request, year):

    transactions = Transaction.objects.filter(transaction_at__year=year)

    summary = {}

    for transaction in transactions:

        category = transaction.category
        month = transaction.transaction_at.month

        if category not in summary:
            summary[category] = {}

        if month not in summary[category]:
            summary[category][month] = {"credit": 0, "debit": 0, }

        if transaction.event_type == Transaction.EventType.CREDIT:
            summary[category][month]["credit"] += float(transaction.amount)
        else:
            summary[category][month]["debit"] += float(transaction.amount)

    return Response({"year": year, "summary": summary, })


@api_view(["GET"])
def categories(request):
    categories = (Transaction.objects.values_list(
        "category", flat=True).distinct().order_by("category"))

    return Response({"categories": list(categories)})


@api_view(["GET"])
def recent_transactions(request):
    try:
        limit = int(request.GET.get("n", 5))
    except (TypeError, ValueError):
        limit = 5

    # Keep the endpoint reasonable even if someone passes a huge number.
    limit = max(1, min(limit, 50))

    transactions = (
        Transaction.objects
        .all()
        .order_by("-transaction_at")[:limit]
    )

    serializer = TransactionSerializer(transactions, many=True)

    return Response({"transactions": serializer.data})


def add_related_transaction(transaction_id, related_id):
    transaction_id = str(transaction_id)
    related_id = str(related_id)

    transaction = Transaction.objects.get(id=transaction_id)
    related = Transaction.objects.get(id=related_id)

    if related_id not in transaction.related_transactions:
        transaction.related_transactions.append(related_id)
        transaction.save(update_fields=["related_transactions", "updated_at"])

    if transaction_id not in related.related_transactions:
        related.related_transactions.append(transaction_id)
        related.save(update_fields=["related_transactions", "updated_at"])


def remove_related_transaction(transaction_id, related_id):
    transaction_id = str(transaction_id)
    related_id = str(related_id)

    transaction = Transaction.objects.get(id=transaction_id)
    related = Transaction.objects.get(id=related_id)

    if related_id in transaction.related_transactions:
        transaction.related_transactions.remove(related_id)
        transaction.save(update_fields=["related_transactions", "updated_at"])

    if transaction_id in related.related_transactions:
        related.related_transactions.remove(transaction_id)
        related.save(update_fields=["related_transactions", "updated_at"])
