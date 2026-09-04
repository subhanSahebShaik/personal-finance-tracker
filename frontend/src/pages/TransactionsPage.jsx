import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getTransactions } from "../api";
import AppShell from "../components/AppShell";
import StateMessage from "../components/StateMessage";
import { MONTH_NAMES, formatCurrency, formatDateTime } from "../utils/finance";
import { useAuth } from "../auth/AuthContext";

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { year, month, category } = useParams();
  const decodedCategory = decodeURIComponent(category);

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await getTransactions({ year, month });
        const filtered = response.transactions
          .filter((item) => item.category === decodedCategory)
          .sort((a, b) => new Date(b.transaction_at) - new Date(a.transaction_at));

        setTransactions(filtered);
      } catch (err) {
        setError(err.message || "Could not load transactions.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [year, month, decodedCategory]);

  const totals = useMemo(() => {
    let credit = 0;
    let debit = 0;

    transactions.forEach((item) => {
      if (item.event_type === "CREDIT") credit += Number(item.amount);
      else debit += Number(item.amount);
    });

    return { credit, debit, net: credit - debit };
  }, [transactions]);

  const monthName = MONTH_NAMES[Number(month) - 1];

  return (
    <AppShell title={decodedCategory} meta={`${monthName} ${year}`} backTo="/"
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
      }>
      <section className="summary-strip summary-strip--compact">
        <div>
          <span>In</span>
          <strong className="money-credit">{formatCurrency(totals.credit)}</strong>
        </div>
        <div>
          <span>Out</span>
          <strong className="money-debit">{formatCurrency(totals.debit)}</strong>
        </div>
        <div>
          <span>Net</span>
          <strong>{formatCurrency(totals.net)}</strong>
        </div>
      </section>

      {loading ? (
        <StateMessage title="Loading…" />
      ) : error ? (
        <StateMessage title="Couldn’t load transactions" message={error} />
      ) : transactions.length === 0 ? (
        <StateMessage title="Nothing here" />
      ) : (
        <section className="list-panel">
          <div className="list-meta">{transactions.length} entries</div>

          <div className="transaction-list">
            {transactions.map((item) => (
              <button
                key={item.id}
                className="transaction-row"
                onClick={() =>
                  navigate(`/transaction/${item.id}`, {
                    state: {
                      backTo: `/transactions/${year}/${month}/${encodeURIComponent(decodedCategory)}`,
                    },
                  })
                }
              >
                <div className="transaction-row__main">
                  <span
                    className={`transaction-dot ${item.event_type === "CREDIT"
                      ? "transaction-dot--credit"
                      : "transaction-dot--debit"
                      }`}
                  />

                  <div>
                    <strong>{item.event_details || item.category}</strong>
                    <span>{formatDateTime(item.transaction_at)}</span>
                  </div>
                </div>

                <strong
                  className={
                    item.event_type === "CREDIT" ? "money-credit" : "money-debit"
                  }
                >
                  {item.event_type === "CREDIT" ? "+" : "−"}
                  {formatCurrency(item.amount)}
                </strong>
              </button>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
