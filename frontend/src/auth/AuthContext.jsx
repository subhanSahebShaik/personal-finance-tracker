import { createContext, useContext, useEffect, useState } from "react";
import api, {
    setAuthHandlers,
    setAccessToken,
    clearAuthTokens,
} from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(
        Boolean(localStorage.getItem("access_token"))
    );

    const [loginOpen, setLoginOpen] = useState(false);
    const [loginError, setLoginError] = useState("");

    useEffect(() => {
        setAuthHandlers({
            onUnauthorized: () => {
                setLoginError("");
                setLoginOpen(true);
            },
        });

        return () => {
            setAuthHandlers({});
        };
    }, []);

    const login = async (username, password) => {
        setLoginError("");

        try {
            const response = await api.post(
                "/auth/token/",
                {
                    username,
                    password,
                },
                {
                    skipAuth: true,
                }
            );

            const { access, refresh } = response.data;

            localStorage.setItem("access_token", access);
            localStorage.setItem("refresh_token", refresh);

            setAccessToken(access);
            setIsAuthenticated(true);
            setLoginOpen(false);

            return true;
        } catch (error) {
            setLoginError(
                error.response?.data?.detail ||
                "Invalid username or password."
            );

            return false;
        }
    };

    const logout = () => {
        clearAuthTokens();
        setIsAuthenticated(false);
        setLoginError("");
        setLoginOpen(true);
    };

    const value = {
        isAuthenticated,
        loginOpen,
        loginError,
        login,
        logout,
        closeLogin: () => setLoginOpen(false),
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}