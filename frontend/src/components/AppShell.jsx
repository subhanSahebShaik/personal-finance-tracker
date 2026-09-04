import { Link } from "react-router-dom";

export default function AppShell({ title, meta, backTo, actions, children }) {

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar__main">
          {backTo ? (
            <Link className="icon-button" to={backTo} aria-label="Go back">
              ←
            </Link>
          ) : (
            <Link className="brand" to="/" aria-label="Home">
              ₹
            </Link>
          )}

          <div className="topbar__title">
            <h1>{title}</h1>
            {meta && <span>{meta}</span>}
          </div>
        </div>

        {actions && <div className="topbar__actions">{actions}</div>}

      </header>

      {children}
    </main>
  );
}
