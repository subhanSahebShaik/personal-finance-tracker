import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getSummary } from "../api";
import AppShell from "../components/AppShell";
import StateMessage from "../components/StateMessage";
import AddTransactionModal from "../components/AddTransactionModal";
import { MONTHS, formatCurrency, getCellNet } from "../utils/finance";
import { useAuth } from "../auth/AuthContext";

function buildYearOptions() {
  const current = new Date().getFullYear();
  return Array.from({ length: 11 }, (_, index) => current + 2 - index);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        setData(await getSummary(year));
      } catch (err) {
        setError(err.message || "Could not load summary.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [year, refreshKey]);

  const categories = useMemo(
    () => Object.keys(data?.summary || {}).sort((a, b) => a.localeCompare(b)),
    [data]
  );

  const totals = useMemo(() => {
    let credit = 0;
    let debit = 0;

    Object.values(data?.summary || {}).forEach((months) => {
      Object.values(months).forEach((cell) => {
        credit += Number(cell.credit || 0);
        debit += Number(cell.debit || 0);
      });
    });

    return { credit, debit, net: credit - debit };
  }, [data]);

  return (
    <AppShell
      title="Money"
      actions={
        <div className="dashboard-actions">
          <select
            className="compact-select"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            aria-label="Year"
          >
            {buildYearOptions().map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            className="primary-button"
            onClick={() => setShowAddTransaction(true)}
          >
            <span aria-hidden="true">＋</span>
            <span>Add</span>
          </button>

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
      <section className="summary-strip" aria-label="Year summary">
        <div>
          <span>In</span>
          <strong className="money-credit">{formatCurrency(totals.credit)}</strong>
        </div>
        <div>
          <span>Out</span>
          <strong className="money-debit">{formatCurrency(totals.debit)}</strong>
        </div>
        <div>
          <span>Balance</span>
          <strong>{formatCurrency(totals.net)}</strong>
        </div>
      </section>

      {loading ? (
        <StateMessage title="Loading…" />
      ) : error ? (
        <StateMessage title="Couldn’t load data" message={error} />
      ) : categories.length === 0 ? (
        <StateMessage title="No transactions" message={`Nothing recorded in ${year}.`} />
      ) : (
        <section className="board-panel">
          <div className="board-scroll">
            <table className="finance-table">
              <thead>
                <tr>
                  <th className="sticky-column">Category</th>
                  {MONTHS.map((month) => (
                    <th key={month}>{month.slice(0, 3)}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {categories.map((category) => (
                  <tr key={category}>
                    <th className="sticky-column category-name">{category}</th>

                    {MONTHS.map((_, index) => {
                      const month = index + 1;
                      const cell = data.summary[category]?.[month];
                      const credit = Number(cell?.credit || 0);
                      const debit = Number(cell?.debit || 0);
                      const net = getCellNet(cell);

                      return (
                        <td key={month}>
                          <button
                            className="finance-cell"
                            disabled={!cell}
                            onClick={() =>
                              navigate(
                                `/transactions/${year}/${month}/${encodeURIComponent(category)}`
                              )
                            }
                          >
                            {!cell ? (
                              <span className="cell-zero">·</span>
                            ) : (
                              <>
                                <strong
                                  className={
                                    net > 0
                                      ? "money-credit"
                                      : net < 0
                                        ? "money-debit"
                                        : ""
                                  }
                                >
                                  {net < 0 ? "−" : net > 0 ? "+" : ""}
                                  {formatCurrency(Math.abs(net))}
                                </strong>

                                {(credit > 0 || debit > 0) && (
                                  <small>
                                    {credit > 0 && `+${formatCurrency(credit)}`}
                                    {credit > 0 && debit > 0 && " / "}
                                    {debit > 0 && `−${formatCurrency(debit)}`}
                                  </small>
                                )}
                              </>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showAddTransaction && (
        <AddTransactionModal
          onClose={() => setShowAddTransaction(false)}
          onCreated={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </AppShell>
  );
}
