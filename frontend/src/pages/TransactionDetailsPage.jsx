import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { getTransaction } from "../api";
import AppShell from "../components/AppShell";
import StateMessage from "../components/StateMessage";
import { formatCurrency, formatDateTime } from "../utils/finance";
import { useAuth } from "../auth/AuthContext";

export default function TransactionDetailsPage() {
  const { transactionId } = useParams();
  const location = useLocation();

  const [transaction, setTransaction] = useState(null);
  const [relatedTransactions, setRelatedTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { isAuthenticated, logout } = useAuth();

  const backTo = location.state?.backTo || "/";

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await getTransaction(transactionId);
        setTransaction(response);

        const related = await Promise.all(
          (response.related_transactions || []).map((id) =>
            getTransaction(id).catch(() => null)
          )
        );

        setRelatedTransactions(related.filter(Boolean));
      } catch (err) {
        setError(err.message || "Could not load transaction.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [transactionId]);

  const repayment = useMemo(() => {
    if (!transaction?.is_returnable) return null;

    const expected = Number(transaction.returnable_amount || 0);
    const returned = relatedTransactions
      .filter((item) => item.event_type === "CREDIT")
      .reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      expected,
      returned: Math.min(returned, expected),
      outstanding: Math.max(expected - returned, 0),
    };
  }, [transaction, relatedTransactions]);

  if (loading) {
    return (
      <AppShell title="Transaction" backTo={backTo}>
        <StateMessage title="Loading…" />
      </AppShell>
    );
  }

  if (error || !transaction) {
    return (
      <AppShell title="Transaction" backTo={backTo}>
        <StateMessage title="Couldn’t load transaction" message={error} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={transaction.event_details || "Transaction"}
      meta={transaction.category}
      backTo={backTo}
      actions={
        <div className="dashboard-actions">
          {isAuthenticated && (
            <button
              type="button"
              className="logout-button"
              onClick={logout}
            >
              Sign out
            </button>
          )}
        </div>
      }
    >
      <section className="detail-panel">
        <div className="detail-amount-row">
          <div>
            <span className="muted">{formatDateTime(transaction.transaction_at)}</span>
            <span
              className={`type-label ${
                transaction.event_type === "CREDIT"
                  ? "type-label--credit"
                  : "type-label--debit"
              }`}
            >
              {transaction.event_type === "CREDIT" ? "Credit" : "Debit"}
            </span>
          </div>

          <strong
            className={`detail-amount ${
              transaction.event_type === "CREDIT" ? "money-credit" : "money-debit"
            }`}
          >
            {transaction.event_type === "CREDIT" ? "+" : "−"}
            {formatCurrency(transaction.amount)}
          </strong>
        </div>

        <div className="detail-fields">
          <div>
            <span>Category</span>
            <strong>{transaction.category}</strong>
          </div>
          <div>
            <span>Returnable</span>
            <strong>{transaction.is_returnable ? "Yes" : "No"}</strong>
          </div>
          <div>
            <span>Created</span>
            <strong>{formatDateTime(transaction.created_at)}</strong>
          </div>
          <div>
            <span>Updated</span>
            <strong>{formatDateTime(transaction.updated_at)}</strong>
          </div>
        </div>

        {transaction.event_details && (
          <div className="detail-note">
            <span>Note</span>
            <p>{transaction.event_details}</p>
          </div>
        )}

        {repayment && (
          <div className="returnable-block">
            <span className="block-label">Return</span>
            <div className="returnable-values">
              <div>
                <span>Expected</span>
                <strong>{formatCurrency(repayment.expected)}</strong>
              </div>
              <div>
                <span>Returned</span>
                <strong>{formatCurrency(repayment.returned)}</strong>
              </div>
              <div>
                <span>Left</span>
                <strong>{formatCurrency(repayment.outstanding)}</strong>
              </div>
            </div>
          </div>
        )}
      </section>

      {relatedTransactions.length > 0 && (
        <section className="related-panel">
          <div className="panel-title">Related</div>

          {relatedTransactions.map((item) => (
            <Link
              key={item.id}
              className="related-row"
              to={`/transaction/${item.id}`}
              state={{ backTo: `/transaction/${transaction.id}` }}
            >
              <div>
                <strong>{item.event_details || item.category}</strong>
                <span>{formatDateTime(item.transaction_at)}</span>
              </div>

              <strong
                className={
                  item.event_type === "CREDIT" ? "money-credit" : "money-debit"
                }
              >
                {item.event_type === "CREDIT" ? "+" : "−"}
                {formatCurrency(item.amount)}
              </strong>
            </Link>
          ))}
        </section>
      )}
    </AppShell>
  );
}
