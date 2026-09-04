import { useEffect, useMemo, useRef, useState } from "react";
import { createTransaction, getCategories } from "../api";

function localDateTimeValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

const INITIAL_FORM = {
  amount: "",
  event_details: "",
  event_type: "DEBIT",
  category: "",
  is_returnable: false,
  returnable_amount: "",
  transaction_at: "",
};

export default function AddTransactionModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    ...INITIAL_FORM,
    transaction_at: localDateTimeValue(),
  });
  const [categories, setCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const categoryRef = useRef(null);

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getCategories();
        setCategories(data.categories || []);
      } catch {
        setError("Couldn’t load categories.");
      } finally {
        setLoadingCategories(false);
      }
    }

    loadCategories();
  }, []);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (categoryRef.current && !categoryRef.current.contains(event.target)) {
        setShowCategories(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const filteredCategories = useMemo(() => {
    const search = categorySearch.trim().toLowerCase();
    if (!search) return categories;
    return categories.filter((category) =>
      category.toLowerCase().includes(search)
    );
  }, [categories, categorySearch]);

  const normalizedSearch = categorySearch.trim();
  const exactMatch = categories.some(
    (category) => category.toLowerCase() === normalizedSearch.toLowerCase()
  );

  function selectCategory(category) {
    updateField("category", category);
    setCategorySearch(category);
    setShowCategories(false);
  }

  function handleCategorySearch(value) {
    setCategorySearch(value);
    updateField("category", value);
    setShowCategories(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const transaction = {
        amount: form.amount,
        event_details: form.event_details.trim(),
        event_type: form.event_type,
        category: form.category.trim(),
        is_returnable: form.is_returnable,
        returnable_amount: form.is_returnable
          ? form.returnable_amount || "0"
          : "0",
        related_transactions: [],
        transaction_at: new Date(form.transaction_at).toISOString(),
      };

      const created = await createTransaction(transaction);
      onCreated(created);
      onClose();
    } catch (err) {
      const detail = err.response?.data;
      setError(
        detail
          ? typeof detail === "string"
            ? detail
            : Object.values(detail).flat().join(" ")
          : err.message || "Couldn’t save transaction."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="transaction-modal"
        onMouseDown={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="add-transaction-title"
      >
        <header className="modal-header">
          <h2 id="add-transaction-title">Add transaction</h2>
          <button className="icon-button icon-button--plain" onClick={onClose} type="button">
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="type-switch" aria-label="Transaction type">
            <button
              type="button"
              className={form.event_type === "DEBIT" ? "active" : ""}
              onClick={() => updateField("event_type", "DEBIT")}
            >
              Debit
            </button>
            <button
              type="button"
              className={form.event_type === "CREDIT" ? "active" : ""}
              onClick={() => updateField("event_type", "CREDIT")}
            >
              Credit
            </button>
          </div>

          <label className="amount-field">
            <span>₹</span>
            <input
              autoFocus
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => updateField("amount", event.target.value)}
              placeholder="0"
              required
            />
          </label>

          <div className="form-grid">
            <div className="form-field category-field" ref={categoryRef}>
              <label htmlFor="transaction-category">Category</label>
              <div className="category-selector">
                <input
                  id="transaction-category"
                  type="text"
                  value={categorySearch}
                  onFocus={() => setShowCategories(true)}
                  onChange={(event) => handleCategorySearch(event.target.value)}
                  placeholder={loadingCategories ? "Loading…" : "Search or create"}
                  disabled={loadingCategories}
                  required
                />

                {showCategories && !loadingCategories && (
                  <div className="category-dropdown">
                    {filteredCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className="category-option"
                        onClick={() => selectCategory(category)}
                      >
                        {category}
                      </button>
                    ))}

                    {normalizedSearch && !exactMatch && (
                      <button
                        type="button"
                        className="category-create"
                        onClick={() => selectCategory(normalizedSearch)}
                      >
                        + {normalizedSearch}
                      </button>
                    )}

                    {!normalizedSearch && filteredCategories.length === 0 && (
                      <div className="category-empty">No categories</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="transaction-date">Date & time</label>
              <input
                id="transaction-date"
                type="datetime-local"
                value={form.transaction_at}
                onChange={(event) => updateField("transaction_at", event.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="transaction-note">Note</label>
            <textarea
              id="transaction-note"
              value={form.event_details}
              onChange={(event) => updateField("event_details", event.target.value)}
              placeholder="What happened?"
              rows="3"
              required
            />
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.is_returnable}
              onChange={(event) => updateField("is_returnable", event.target.checked)}
            />
            <span>Returnable</span>
          </label>

          {form.is_returnable && (
            <div className="form-field return-field">
              <label htmlFor="return-amount">Expected back</label>
              <input
                id="return-amount"
                type="number"
                min="0"
                max={form.amount || undefined}
                step="0.01"
                value={form.returnable_amount}
                onChange={(event) => updateField("returnable_amount", event.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <footer className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving || !form.category.trim() || !form.amount || !form.transaction_at}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
