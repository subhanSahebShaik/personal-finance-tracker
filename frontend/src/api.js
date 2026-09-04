import axios from "axios";

const api = axios.create({
  baseURL: "https://personal-finance-tracker-backend-fecx.onrender.com",
  headers: {
    "Content-Type": "application/json",
  },
});

let accessToken = localStorage.getItem("access_token");

let authHandlers = {};

let isRefreshing = false;
let pendingRequests = [];

export const setAccessToken = (token) => {
  accessToken = token;
};

export const clearAuthTokens = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");

  accessToken = null;
};

export const setAuthHandlers = (handlers) => {
  authHandlers = handlers;
};

const processPendingRequests = (token) => {
  pendingRequests.forEach(({ resolve }) => {
    resolve(token);
  });

  pendingRequests = [];
};

const rejectPendingRequests = () => {
  pendingRequests.forEach(({ reject }) => {
    reject(new Error("Authentication required"));
  });

  pendingRequests = [];
};


/*
 * Add JWT to every normal API request.
 */
api.interceptors.request.use((config) => {
  if (!config.skipAuth && accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});


/*
 * Handle authentication failures.
 */
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    /*
     * Don't intercept the login request itself.
     */
    if (
      originalRequest?.skipAuth ||
      originalRequest?.url?.includes("/auth/token/")
    ) {
      return Promise.reject(error);
    }

    /*
     * Only handle 401 responses.
     */
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    /*
     * Prevent infinite retry loops.
     */
    if (originalRequest._retry) {
      clearAuthTokens();

      authHandlers.onUnauthorized?.();

      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const refreshToken = localStorage.getItem("refresh_token");

    /*
     * If there is no refresh token, authentication is required.
     */
    if (!refreshToken) {
      authHandlers.onUnauthorized?.();

      return new Promise((resolve, reject) => {
        pendingRequests.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    /*
     * If another request is already refreshing,
     * wait for that refresh.
     */
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    /*
     * Try refreshing the access token.
     */
    isRefreshing = true;

    try {
      const response = await api.post(
        "/auth/token/refresh/",
        {
          refresh: refreshToken,
        },
        {
          skipAuth: true,
        }
      );

      const newAccessToken = response.data.access;

      setAccessToken(newAccessToken);
      localStorage.setItem("access_token", newAccessToken);

      isRefreshing = false;

      processPendingRequests(newAccessToken);

      originalRequest.headers.Authorization =
        `Bearer ${newAccessToken}`;

      return api(originalRequest);

    } catch (refreshError) {
      isRefreshing = false;

      clearAuthTokens();

      authHandlers.onUnauthorized?.();

      return new Promise((resolve, reject) => {
        pendingRequests.push({
          resolve: (token) => {
            originalRequest.headers.Authorization =
              `Bearer ${token}`;

            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }
  }
);


/* ---------------- API functions ---------------- */

export const getSummary = (year) =>
  api.get(`/summary/${year}/`).then((response) => response.data);


export const getTransactions = ({ year, month }) => {
  const params = {};

  if (year) params.year = year;
  if (month) params.month = month;

  return api
    .get("/transactions/", { params })
    .then((response) => response.data);
};


export const getTransaction = (id) =>
  api
    .get(`/transactions/${id}/`)
    .then((response) => response.data);


export const createTransaction = (transaction) =>
  api
    .post("/transactions/", transaction)
    .then((response) => response.data);


export const updateTransaction = (id, transaction) =>
  api
    .patch(`/transactions/${id}/`, transaction)
    .then((response) => response.data);


export const deleteTransaction = (id) =>
  api
    .delete(`/transactions/${id}/`)
    .then((response) => response.data);


export const getCategories = () =>
  api
    .get("/categories/")
    .then((response) => response.data);


export default api;
