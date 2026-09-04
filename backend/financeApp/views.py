from django.db.models import Sum
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

    if request.method == "GET":

        serializer = TransactionSerializer(transaction)

        return Response(serializer.data)

    if request.method == "PATCH":

        serializer = TransactionSerializer(
            transaction,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            transaction = serializer.save()

            return Response(TransactionSerializer(transaction).data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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
