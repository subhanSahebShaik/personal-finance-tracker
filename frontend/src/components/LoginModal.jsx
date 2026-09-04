import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

export default function LoginModal() {
    const {
        loginOpen,
        loginError,
        login,
    } = useAuth();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    if (!loginOpen) {
        return null;
    }

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!username || !password) {
            return;
        }

        setLoading(true);

        const success = await login(username, password);

        if (success) {
            setPassword("");
        }

        setLoading(false);
    };

    return (
        <div className="login-overlay">
            <div className="login-modal">

                <div className="login-mark">₹</div>

                <h2>Sign in</h2>

                <p className="login-subtitle">
                    Your finance data is private.
                </p>

                <form onSubmit={handleSubmit}>

                    <label>
                        Username
                    </label>

                    <input
                        type="text"
                        value={username}
                        onChange={(event) =>
                            setUsername(event.target.value)
                        }
                        autoComplete="username"
                        autoFocus
                    />

                    <label>
                        Password
                    </label>

                    <input
                        type="password"
                        value={password}
                        onChange={(event) =>
                            setPassword(event.target.value)
                        }
                        autoComplete="current-password"
                    />

                    {loginError && (
                        <div className="login-error">
                            {loginError}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-button"
                        disabled={loading}
                    >
                        {loading ? "Signing in..." : "Sign in"}
                    </button>

                </form>

            </div>
        </div>
    );
}
