import { useEffect, useMemo, useRef, useState } from "react";

import {
  createTransaction,
  getCategories,
  getTransactions,
  updateTransaction,
} from "../api";


function localDateTimeValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();

  return new Date(
    now.getTime() - offset * 60 * 1000
  )
    .toISOString()
    .slice(0, 16);
}


function transactionDateTimeValue(value) {
  if (!value) {
    return localDateTimeValue();
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();

  return new Date(
    date.getTime() - offset * 60 * 1000
  )
    .toISOString()
    .slice(0, 16);
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


export default function AddTransactionModal({
  transaction = null,
  onClose,
  onCreated,
  onUpdated,
}) {

  const isEditing = Boolean(transaction);

  const [form, setForm] = useState({
    ...INITIAL_FORM,
    transaction_at: localDateTimeValue(),
  });

  const [categories, setCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [allTransactions, setAllTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const [relatedSearch, setRelatedSearch] = useState("");

  const [selectedRelatedIds, setSelectedRelatedIds] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const categoryRef = useRef(null);


  /*
   * ---------------------------------------------------------
   * Load existing transaction into form when editing
   * ---------------------------------------------------------
   */

  useEffect(() => {

    if (!transaction) {
      setForm({
        ...INITIAL_FORM,
        transaction_at: localDateTimeValue(),
      });

      setSelectedRelatedIds([]);

      return;
    }

    setForm({
      amount: transaction.amount || "",
      event_details: transaction.event_details || "",
      event_type: transaction.event_type || "DEBIT",
      category: transaction.category || "",
      is_returnable: Boolean(transaction.is_returnable),
      returnable_amount: transaction.returnable_amount || "",
      transaction_at: transactionDateTimeValue(
        transaction.transaction_at
      ),
    });

    setCategorySearch(transaction.category || "");

    setSelectedRelatedIds(
      transaction.related_transactions || []
    );

  }, [transaction]);


  /*
   * ---------------------------------------------------------
   * Load categories
   * ---------------------------------------------------------
   */

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


  /*
   * ---------------------------------------------------------
   * Load transactions for relationship selector
   * Only needed while editing
   * ---------------------------------------------------------
   */

  useEffect(() => {

    if (!isEditing) {
      return;
    }

    async function loadTransactions() {

      setLoadingTransactions(true);

      try {

        const data = await getTransactions({});

        setAllTransactions(
          data.transactions || []
        );

      } catch {

        setError(
          "Couldn’t load transactions for related links."
        );

      } finally {

        setLoadingTransactions(false);

      }
    }

    loadTransactions();

  }, [isEditing]);


  /*
   * ---------------------------------------------------------
   * Close modal / outside click / Escape
   * ---------------------------------------------------------
   */

  useEffect(() => {

    function handleOutsideClick(event) {

      if (
        categoryRef.current &&
        !categoryRef.current.contains(event.target)
      ) {
        setShowCategories(false);
      }

    }

    function handleKeyDown(event) {

      if (event.key === "Escape") {
        onClose();
      }

    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {

      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

    };

  }, [onClose]);


  /*
   * ---------------------------------------------------------
   * Generic form update
   * ---------------------------------------------------------
   */

  function updateField(field, value) {

    setForm((current) => ({
      ...current,
      [field]: value,
    }));

  }


  /*
   * ---------------------------------------------------------
   * Categories
   * ---------------------------------------------------------
   */

  const filteredCategories = useMemo(() => {

    const search = categorySearch
      .trim()
      .toLowerCase();

    if (!search) {
      return categories;
    }

    return categories.filter((category) =>
      category
        .toLowerCase()
        .includes(search)
    );

  }, [categories, categorySearch]);


  const normalizedSearch =
    categorySearch.trim();


  const exactMatch = categories.some(
    (category) =>
      category.toLowerCase() ===
      normalizedSearch.toLowerCase()
  );


  function selectCategory(category) {

    updateField(
      "category",
      category
    );

    setCategorySearch(category);

    setShowCategories(false);

  }


  function handleCategorySearch(value) {

    setCategorySearch(value);

    updateField(
      "category",
      value
    );

    setShowCategories(true);

  }


  /*
   * ---------------------------------------------------------
   * Related transactions
   * ---------------------------------------------------------
   */

  const filteredRelatedTransactions = useMemo(() => {

    const search = relatedSearch
      .trim()
      .toLowerCase();

    return allTransactions
      .filter((item) => {

        /*
         * Don't allow the transaction to relate
         * to itself.
         */
        if (
          isEditing &&
          item.id === transaction.id
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        return `${item.event_details || ""} ${item.category || ""}`
          .toLowerCase()
          .includes(search);

      });

  }, [
    allTransactions,
    relatedSearch,
    isEditing,
    transaction,
  ]);


  function toggleRelatedTransaction(id) {

    setSelectedRelatedIds((current) => {

      if (current.includes(id)) {

        return current.filter(
          (item) => item !== id
        );

      }

      return [
        ...current,
        id,
      ];

    });

  }


  /*
   * ---------------------------------------------------------
   * Submit
   * ---------------------------------------------------------
   */

  async function handleSubmit(event) {

    event.preventDefault();

    setSaving(true);
    setError("");

    try {

      const payload = {

        amount: form.amount,

        event_details:
          form.event_details.trim(),

        event_type:
          form.event_type,

        category:
          form.category.trim(),

        is_returnable:
          form.is_returnable,

        returnable_amount:
          form.is_returnable
            ? form.returnable_amount || "0"
            : "0",

        /*
         * New transaction:
         * no relationships yet.
         *
         * Existing transaction:
         * send the complete desired relationship list.
         */
        related_transactions:
          isEditing
            ? selectedRelatedIds
            : [],

        transaction_at:
          new Date(
            form.transaction_at
          ).toISOString(),

      };


      if (isEditing) {

        const updated =
          await updateTransaction(
            transaction.id,
            payload
          );

        onUpdated?.(updated);

      } else {

        const created =
          await createTransaction(
            payload
          );

        onCreated?.(created);

      }

      onClose();

    } catch (err) {

      const detail =
        err.response?.data;

      setError(
        detail
          ? typeof detail === "string"
            ? detail
            : Object.values(detail)
              .flat()
              .join(" ")
          : err.message ||
          "Couldn’t save transaction."
      );

    } finally {

      setSaving(false);

    }

  }


  /*
   * ---------------------------------------------------------
   * Render
   * ---------------------------------------------------------
   */

  return (

    <div
      className="modal-backdrop"
      onMouseDown={onClose}
    >

      <section
        className="transaction-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
        aria-modal="true"
        role="dialog"
        aria-labelledby="transaction-modal-title"
      >

        <header className="modal-header">

          <h2 id="transaction-modal-title">
            {isEditing
              ? "Edit transaction"
              : "Add transaction"}
          </h2>

          <button
            className="icon-button icon-button--plain"
            onClick={onClose}
            type="button"
          >
            ×
          </button>

        </header>


        <form onSubmit={handleSubmit}>

          {/* ------------------------------------------------ */}
          {/* Type */}
          {/* ------------------------------------------------ */}

          <div
            className="type-switch"
            aria-label="Transaction type"
          >

            <button
              type="button"
              className={
                form.event_type === "DEBIT"
                  ? "active"
                  : ""
              }
              onClick={() =>
                updateField(
                  "event_type",
                  "DEBIT"
                )
              }
            >
              Debit
            </button>

            <button
              type="button"
              className={
                form.event_type === "CREDIT"
                  ? "active"
                  : ""
              }
              onClick={() =>
                updateField(
                  "event_type",
                  "CREDIT"
                )
              }
            >
              Credit
            </button>

          </div>


          {/* ------------------------------------------------ */}
          {/* Amount */}
          {/* ------------------------------------------------ */}

          <label className="amount-field">

            <span>₹</span>

            <input
              autoFocus
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) =>
                updateField(
                  "amount",
                  event.target.value
                )
              }
              placeholder="0"
              required
            />

          </label>


          {/* ------------------------------------------------ */}
          {/* Category + Date */}
          {/* ------------------------------------------------ */}

          <div className="form-grid">

            <div
              className="form-field category-field"
              ref={categoryRef}
            >

              <label htmlFor="transaction-category">
                Category
              </label>

              <div className="category-selector">

                <input
                  id="transaction-category"
                  type="text"
                  value={categorySearch}
                  onFocus={() =>
                    setShowCategories(true)
                  }
                  onChange={(event) =>
                    handleCategorySearch(
                      event.target.value
                    )
                  }
                  placeholder={
                    loadingCategories
                      ? "Loading…"
                      : "Search or create"
                  }
                  disabled={
                    loadingCategories
                  }
                  required
                />

                {showCategories &&
                  !loadingCategories && (

                    <div className="category-dropdown">

                      {filteredCategories.map(
                        (category) => (

                          <button
                            key={category}
                            type="button"
                            className="category-option"
                            onClick={() =>
                              selectCategory(
                                category
                              )
                            }
                          >
                            {category}
                          </button>

                        )
                      )}

                      {normalizedSearch &&
                        !exactMatch && (

                          <button
                            type="button"
                            className="category-create"
                            onClick={() =>
                              selectCategory(
                                normalizedSearch
                              )
                            }
                          >
                            + {normalizedSearch}
                          </button>

                        )}

                      {!normalizedSearch &&
                        filteredCategories.length ===
                        0 && (

                          <div className="category-empty">
                            No categories
                          </div>

                        )}

                    </div>

                  )}

              </div>

            </div>


            <div className="form-field">

              <label htmlFor="transaction-date">
                Date & time
              </label>

              <input
                id="transaction-date"
                type="datetime-local"
                value={
                  form.transaction_at
                }
                onChange={(event) =>
                  updateField(
                    "transaction_at",
                    event.target.value
                  )
                }
                required
              />

            </div>

          </div>


          {/* ------------------------------------------------ */}
          {/* Note */}
          {/* ------------------------------------------------ */}

          <div className="form-field">

            <label htmlFor="transaction-note">
              Note
            </label>

            <textarea
              id="transaction-note"
              value={
                form.event_details
              }
              onChange={(event) =>
                updateField(
                  "event_details",
                  event.target.value
                )
              }
              placeholder="What happened?"
              rows="3"
              required
            />

          </div>


          {/* ------------------------------------------------ */}
          {/* Returnable */}
          {/* ------------------------------------------------ */}

          <label className="check-row">

            <input
              type="checkbox"
              checked={
                form.is_returnable
              }
              onChange={(event) =>
                updateField(
                  "is_returnable",
                  event.target.checked
                )
              }
            />

            <span>
              Returnable
            </span>

          </label>


          {form.is_returnable && (

            <div className="form-field return-field">

              <label htmlFor="return-amount">
                Expected back
              </label>

              <input
                id="return-amount"
                type="number"
                min="0"
                max={
                  form.amount || undefined
                }
                step="0.01"
                value={
                  form.returnable_amount
                }
                onChange={(event) =>
                  updateField(
                    "returnable_amount",
                    event.target.value
                  )
                }
                placeholder="0.00"
                required
              />

            </div>

          )}


          {/* ------------------------------------------------ */}
          {/* Related transactions - EDIT ONLY */}
          {/* ------------------------------------------------ */}

          {isEditing && (

            <section className="related-edit-section">

              <div className="related-edit-header">

                <div>

                  <span className="block-label">
                    Related transactions
                  </span>

                  <p className="muted">
                    Link this transaction to
                    existing transactions.
                  </p>

                </div>

              </div>


              {/* Selected transactions */}

              {selectedRelatedIds.length > 0 && (

                <div className="selected-related-list">

                  {selectedRelatedIds.map(
                    (id) => {

                      const item =
                        allTransactions.find(
                          (transactionItem) =>
                            transactionItem.id === id
                        );

                      if (!item) {
                        return null;
                      }

                      return (

                        <div
                          key={item.id}
                          className="selected-related-row"
                        >

                          <div>

                            <strong>
                              {item.event_details ||
                                item.category}
                            </strong>

                            <span>
                              {formatTransactionMeta(
                                item
                              )}
                            </span>

                          </div>

                          <button
                            type="button"
                            className="related-remove"
                            onClick={() =>
                              toggleRelatedTransaction(
                                item.id
                              )
                            }
                            aria-label={`Remove ${item.event_details ||
                              item.category
                              }`}
                          >
                            ×
                          </button>

                        </div>

                      );

                    }
                  )}

                </div>

              )}


              {/* Search */}

              <input
                type="text"
                className="related-search"
                value={
                  relatedSearch
                }
                onChange={(event) =>
                  setRelatedSearch(
                    event.target.value
                  )
                }
                placeholder={
                  loadingTransactions
                    ? "Loading transactions…"
                    : "Search transactions"
                }
                disabled={
                  loadingTransactions
                }
              />


              {!loadingTransactions &&
                relatedSearch.trim() && (

                  <div className="related-picker">

                    {filteredRelatedTransactions
                      .slice(0, 8)
                      .map((item) => {

                        const selected =
                          selectedRelatedIds.includes(
                            item.id
                          );

                        return (

                          <button
                            key={item.id}
                            type="button"
                            className={`related-option ${selected
                                ? "selected"
                                : ""
                              }`}
                            onClick={() =>
                              toggleRelatedTransaction(
                                item.id
                              )
                            }
                          >

                            <span
                              className={`related-option-dot ${item.event_type ===
                                  "CREDIT"
                                  ? "related-option-dot-credit"
                                  : "related-option-dot-debit"
                                }`}
                            />

                            <span className="related-option-content">

                              <strong>
                                {item.event_details ||
                                  item.category}
                              </strong>

                              <small>
                                {formatTransactionMeta(
                                  item
                                )}
                              </small>

                            </span>

                            <span className="related-option-amount">

                              {item.event_type ===
                                "CREDIT"
                                ? "+"
                                : "−"}

                              {formatCurrencyValue(
                                item.amount
                              )}

                            </span>

                            <span className="related-option-check">
                              {selected
                                ? "✓"
                                : ""}
                            </span>

                          </button>

                        );

                      })}

                    {filteredRelatedTransactions
                      .length === 0 && (

                        <div className="related-empty">
                          No matching transactions.
                        </div>

                      )}

                  </div>

                )}

            </section>

          )}


          {/* ------------------------------------------------ */}
          {/* Error */}
          {/* ------------------------------------------------ */}

          {error && (

            <div className="form-error">
              {error}
            </div>

          )}


          {/* ------------------------------------------------ */}
          {/* Actions */}
          {/* ------------------------------------------------ */}

          <footer className="modal-actions">

            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={
                saving ||
                !form.category.trim() ||
                !form.amount ||
                !form.transaction_at
              }
            >
              {saving
                ? "Saving…"
                : isEditing
                  ? "Save changes"
                  : "Save"}
            </button>

          </footer>

        </form>

      </section>

    </div>

  );
}


/*
 * Small local helpers.
 * We intentionally keep formatting here simple.
 */

function formatTransactionMeta(transaction) {

  const date = new Date(
    transaction.transaction_at
  ).toLocaleDateString();

  return `${transaction.category} · ${date}`;

}


function formatCurrencyValue(value) {

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }
  ).format(Number(value || 0));

}
