import type { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api/v1";

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json"
  }
});

type AuthHandlers = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  refresh: () => Promise<string | null>;
  clear: () => void;
  onUnauthorized?: () => void;
};

interface RetryConfig extends AxiosRequestConfig {
  __isRetryRequest?: boolean;
}

let handlers: AuthHandlers = {
  getAccessToken: () => null,
  getRefreshToken: () => null,
  refresh: async () => null,
  clear: () => undefined
};

export const configureApiAuth = (partial: Partial<AuthHandlers>) => {
  handlers = { ...handlers, ...partial } as AuthHandlers;
};

let refreshPromise: Promise<string | null> | null = null;

const AUTH_ENDPOINTS = ["/auth/login", "/auth/admin/login", "/auth/refresh", "/auth/logout"];

const isAuthEndpoint = (url?: string | null) => {
  if (!url) {
    return false;
  }
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
};

api.interceptors.request.use((config) => {
  const token = handlers.getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const { response, config } = error;
    const retryConfig = config as RetryConfig | undefined;

    if (
      response?.status === 401 &&
      retryConfig &&
      !retryConfig.__isRetryRequest &&
      !isAuthEndpoint(retryConfig.url)
    ) {
      retryConfig.__isRetryRequest = true;

      if (!refreshPromise) {
        refreshPromise = handlers.refresh().finally(() => {
          refreshPromise = null;
        });
      }

      const newAccessToken = await refreshPromise;
      if (newAccessToken) {
        retryConfig.headers = retryConfig.headers ?? {};
        retryConfig.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(retryConfig);
      }

      handlers.clear();
      handlers.onUnauthorized?.();
    }

    throw error;
  }
);

export default api;
