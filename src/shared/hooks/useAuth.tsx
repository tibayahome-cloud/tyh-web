import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { Context ,
  PropsWithChildren} from "react";

import { isAxiosError } from "axios";

import api, { configureApiAuth } from "../libs/api";
import { buildFieldParams, userPublic } from "../libs/fieldInclude";
import type { AuthUser} from "../schemas/user";
import { mapUserResource } from "../schemas/user";

const STORAGE_KEY = "tiba.auth.tokens";
const USER_STORAGE_KEY = "tiba.auth.user";

type Nullable<T> = T | null;

export type LoginCredentials = {
  emailOrPhone: string;
  password: string;
  remember?: boolean;
};

export type AdminLoginCredentials = {
  email: string;
  password: string;
  remember?: boolean;
};

type AuthTokens = {
  accessToken: Nullable<string>;
  refreshToken: Nullable<string>;
  persist: boolean;
};

export type LoginSuccess = {
  status: "authenticated";
  user: AuthUser | null;
};

export type MfaChallenge = {
  status: "mfa_required";
  method: string;
  sessionHint: string;
  userId?: string;
  availableMethods?: string[];
};

export type LoginResult = LoginSuccess | MfaChallenge;

export type VerifyTwoFactorInput = {
  method: string;
  sessionHint: string;
  code: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  roles: string[];
  permissions: string[];
  accessToken: Nullable<string>;
  refreshToken: Nullable<string>;
  isAuthenticated: boolean;
  hasRefreshToken: boolean;
  isBootstrapping: boolean;
  sessionExpired: boolean;
  loginClientProvider: (credentials: LoginCredentials) => Promise<LoginResult>;
  loginAdmin: (credentials: AdminLoginCredentials) => Promise<LoginResult>;
  verifyTwoFactor: (input: VerifyTwoFactorInput) => Promise<LoginSuccess>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
  bootstrapMe: () => Promise<AuthUser | null>;
  clearSessionExpired: () => void;
  expireSession: () => void;
};

const readStoredTokens = (): AuthTokens => {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, persist: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { accessToken: null, refreshToken: null, persist: false };
    }
    const parsed = JSON.parse(raw) as Partial<AuthTokens>;
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      persist: parsed.persist ?? true
    };
  } catch {
    return { accessToken: null, refreshToken: null, persist: false };
  }
};

const writeStoredTokens = (tokens: AuthTokens) => {
  if (typeof window === "undefined") {
    return;
  }
  if (tokens.persist && tokens.refreshToken) {
    const payload = JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      persist: true
    });
    window.localStorage.setItem(STORAGE_KEY, payload);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
};

const readStoredUser = (): AuthUser | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    const roles = Array.isArray(parsed.roles) ? parsed.roles.filter((r): r is string => typeof r === "string") : [];
    const permissions = Array.isArray(parsed.permissions)
      ? parsed.permissions.filter((p): p is string => typeof p === "string")
      : [];
    const id = parsed?.id;
    if (!id) {
      return null;
    }
    const metaValue =
      parsed.meta && typeof parsed.meta === "object" && !Array.isArray(parsed.meta)
        ? (parsed.meta as Record<string, unknown>)
        : null;
    return {
      id: String(id),
      fullName: typeof parsed.fullName === "string" ? parsed.fullName : "",
      avatarUrl: parsed.avatarUrl ?? null,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      phoneVerifiedAt: parsed.phoneVerifiedAt ?? null,
      roles,
      permissions,
      meta: metaValue
    };
  } catch {
    return null;
  }
};

const writeStoredUser = (user: AuthUser | null) => {
  if (typeof window === "undefined") {
    return;
  }
  if (!user) {
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(
    USER_STORAGE_KEY,
    JSON.stringify({
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      phone: user.phone,
      phoneVerifiedAt: user.phoneVerifiedAt,
      meta: user.meta
    })
  );
};

const extractData = <T,>(payload: unknown): T => {
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

const extractTokens = (payload: unknown): { accessToken: Nullable<string>; refreshToken: Nullable<string> } => {
  const source =
    payload && typeof payload === "object" && "tokens" in (payload as Record<string, unknown>)
      ? (payload as { tokens: Record<string, unknown> }).tokens
      : (payload as Record<string, unknown> | undefined);

  if (!source) {
    return { accessToken: null, refreshToken: null };
  }

  const accessToken =
    (source.access_token as string | undefined) ??
    (source.accessToken as string | undefined) ??
    null;
  const refreshToken =
    (source.refresh_token as string | undefined) ??
    (source.refreshToken as string | undefined) ??
    null;

  return { accessToken, refreshToken };
};

type AuthReactContext = Context<AuthContextValue | undefined>;

const getAuthContext = (): AuthReactContext => {
  if (typeof globalThis !== "undefined") {
    const globalRef = globalThis as typeof globalThis & {
      __tibaAuthContext?: AuthReactContext;
    };
    if (globalRef.__tibaAuthContext) {
      return globalRef.__tibaAuthContext;
    }
    const context = createContext<AuthContextValue | undefined>(undefined);
    globalRef.__tibaAuthContext = context;
    return context;
  }
  return createContext<AuthContextValue | undefined>(undefined);
};

const AuthContext = getAuthContext();

const decodeBase64Url = (input: string): string | null => {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    if (typeof globalThis.atob === "function") {
      return globalThis.atob(normalized);
    }
    // Fallback for Node/Vitest
    if (typeof Buffer !== "undefined") {
      return Buffer.from(normalized, "base64").toString("binary");
    }
  } catch {
    /* noop */
  }
  return null;
};

const decodeTokenExpiry = (token: string | null): number | null => {
  if (!token) {
    return null;
  }
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }
    const decoded = decodeBase64Url(parts[1]);
    if (!decoded) {
      return null;
    }
    const payload = JSON.parse(decoded) as { exp?: number };
    if (!payload.exp) {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
};

const TOKEN_EXPIRY_SKEW_MS = 10_000;

const pickFirstErrorMessage = (input: unknown): string | null => {
  if (!input) {
    return null;
  }

  if (typeof input === "string") {
    return input;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const message = pickFirstErrorMessage(item);
      if (message) {
        return message;
      }
    }
    return null;
  }

  if (typeof input === "object") {
    for (const value of Object.values(input as Record<string, unknown>)) {
      const message = pickFirstErrorMessage(value);
      if (message) {
        return message;
      }
    }
  }

  return null;
};

const resolveApiErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    const message = pickFirstErrorMessage(error.response?.data) ?? error.response?.statusText;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const queryClient = useQueryClient();
  const [tokens, setTokens] = useState<AuthTokens>(() => readStoredTokens());
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);
  const tokensRef = useRef<AuthTokens>(tokens);
  const rememberRef = useRef<boolean>(false);
  const accessExpiryRef = useRef<number | null>(decodeTokenExpiry(tokens.accessToken));
  const refreshExpiryRef = useRef<number | null>(decodeTokenExpiry(tokens.refreshToken));
  const expiryTimerRef = useRef<number | null>(null);

  const setUserState = useCallback((value: AuthUser | null) => {
    setUser(value);
    writeStoredUser(value);
  }, [setUser]);

  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  const clearExpiryTimer = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (expiryTimerRef.current !== null) {
      window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const updateTokens = useCallback((partial: Partial<AuthTokens>) => {
    setTokens((prev) => {
      const next: AuthTokens = {
        accessToken: partial.accessToken ?? prev.accessToken,
        refreshToken: partial.refreshToken ?? prev.refreshToken,
        persist: partial.persist ?? prev.persist
      };

      if (!next.accessToken && !next.refreshToken) {
        next.persist = false;
      }

      writeStoredTokens(next);
      accessExpiryRef.current = decodeTokenExpiry(next.accessToken);
      refreshExpiryRef.current = decodeTokenExpiry(next.refreshToken);
      return next;
    });
  }, []);

  const clearTokens = useCallback(
    (resetSession = false) => {
      setUserState(null);
      rememberRef.current = false;
      queryClient.removeQueries({ queryKey: ["me"], exact: false });
      setTokens(() => {
        const next: AuthTokens = { accessToken: null, refreshToken: null, persist: false };
        writeStoredTokens(next);
        return next;
      });
      accessExpiryRef.current = null;
      refreshExpiryRef.current = null;
      clearExpiryTimer();
      if (resetSession) {
        setSessionExpired(true);
      }
    },
    [clearExpiryTimer, queryClient, setUserState]
  );

  const scheduleAccessExpiryCheck = useCallback(
    (expiry: number | null) => {
      if (typeof window === "undefined") {
        return;
      }
      clearExpiryTimer();
      if (!expiry) {
        return;
      }
      const delay = Math.max(0, expiry - Date.now() - TOKEN_EXPIRY_SKEW_MS);
      if (delay <= 0) {
        clearTokens(true);
        return;
      }
      expiryTimerRef.current = window.setTimeout(() => {
        clearTokens(true);
      }, delay);
    },
    [clearExpiryTimer, clearTokens]
  );

  useEffect(() => {
    accessExpiryRef.current = decodeTokenExpiry(tokens.accessToken);
    refreshExpiryRef.current = decodeTokenExpiry(tokens.refreshToken);
    scheduleAccessExpiryCheck(accessExpiryRef.current);
  }, [scheduleAccessExpiryCheck, tokens.accessToken, tokens.refreshToken]);

  useEffect(() => () => {
    clearExpiryTimer();
  }, [clearExpiryTimer]);

  const isAccessExpired = useCallback(
    () =>
      typeof accessExpiryRef.current === "number" &&
      Date.now() >= accessExpiryRef.current - TOKEN_EXPIRY_SKEW_MS,
    []
  );

  const isRefreshExpired = useCallback(
    () =>
      typeof refreshExpiryRef.current === "number" && Date.now() >= refreshExpiryRef.current,
    []
  );

  const performRefresh = useCallback(async () => {
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    const refreshToken = tokensRef.current.refreshToken;
    if (!refreshToken) {
      clearTokens(true);
      return null;
    }

    refreshInFlight.current = (async () => {
      try {
        const response = await api.post("/auth/refresh", { refresh_token: refreshToken });
        const payload = extractData<Record<string, unknown>>(response.data);
        const { accessToken, refreshToken: nextRefresh } = extractTokens(payload);
        updateTokens({
          accessToken,
          refreshToken: nextRefresh ?? refreshToken
        });
        setSessionExpired(false);
        return accessToken;
      } catch {
        clearTokens(true);
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();

    return refreshInFlight.current;
  }, [clearTokens, updateTokens]);

  useEffect(() => {
    configureApiAuth({
      getAccessToken: () => {
        if (isAccessExpired()) {
          clearTokens(true);
          return null;
        }
        return tokensRef.current.accessToken;
      },
      getRefreshToken: () => {
        if (isRefreshExpired()) {
          clearTokens(true);
          return null;
        }
        return tokensRef.current.refreshToken;
      },
      refresh: performRefresh,
      clear: () => clearTokens(true),
      onUnauthorized: () => setSessionExpired(true)
    });
  }, [clearTokens, isAccessExpired, isRefreshExpired, performRefresh]);

  const bootstrapMe = useCallback(async () => {
    if (!tokensRef.current.accessToken) {
      return null;
    }

    setIsBootstrapping(true);
    try {
      const response = await api.get("/auth/me", {
        params: buildFieldParams(userPublic)
      });

      const payload = extractData<unknown>(response.data);
      const normalized = mapUserResource(payload);
      setUserState(normalized);
      queryClient.setQueryData(["me"], normalized);
      setSessionExpired(false);
      return normalized;
    } catch {
      return null;
    } finally {
      setIsBootstrapping(false);
    }
  }, [queryClient, setUserState]);

  useEffect(() => {
    if (tokens.accessToken) {
      bootstrapMe().catch(() => {
        /* swallow bootstrap errors; handled elsewhere */
      });
    } else {
      setUserState(null);
      queryClient.removeQueries({ queryKey: ["me"], exact: false });
    }
  }, [tokens.accessToken, bootstrapMe, queryClient, setUserState]);

  const loginClientProvider = useCallback(
    async (credentials: LoginCredentials): Promise<LoginResult> => {
      try {
        rememberRef.current = Boolean(credentials.remember);
        const response = await api.post(
          "/auth/login",
          {
            emailOrPhone: credentials.emailOrPhone,
            password: credentials.password
          },
          {
            params: buildFieldParams(userPublic)
          }
        );

        const payload = extractData<Record<string, unknown>>(response.data);
        if (payload && typeof payload === "object" && (payload as { next?: unknown }).next === "2fa_required") {
          const challengePayload = payload as {
            method?: unknown;
            session_hint?: unknown;
            user_id?: unknown;
            available_methods?: unknown;
          };
          const sessionHint = String(challengePayload.session_hint ?? "").trim();
          return {
            status: "mfa_required",
            method: String(challengePayload.method ?? "totp"),
            sessionHint,
            userId:
              challengePayload.user_id !== undefined && challengePayload.user_id !== null
                ? String(challengePayload.user_id)
                : undefined,
            availableMethods: Array.isArray(challengePayload.available_methods)
              ? (challengePayload.available_methods as unknown[]).map((entry) => String(entry))
              : undefined
          };
        }

        const { accessToken, refreshToken } = extractTokens(payload);
        updateTokens({
          accessToken,
          refreshToken,
          persist: Boolean(credentials.remember)
        });

        setSessionExpired(false);

        let normalized: AuthUser | null = null;
        if (payload && typeof payload === "object" && "user" in payload) {
          normalized = mapUserResource((payload as { user: unknown }).user);
          setUserState(normalized);
          queryClient.setQueryData(["me"], normalized);
        } else {
          normalized = await bootstrapMe();
        }

        return { status: "authenticated", user: normalized };
      } catch (error) {
        throw new Error(
          resolveApiErrorMessage(error, "We could not sign you in. Check your credentials and try again.")
        );
      }
    },
    [bootstrapMe, queryClient, setUserState, updateTokens]
  );

  const loginAdmin = useCallback(
    async (credentials: AdminLoginCredentials): Promise<LoginResult> => {
      try {
        rememberRef.current = Boolean(credentials.remember);
        const response = await api.post(
          "/auth/admin/login",
          {
            emailOrPhone: credentials.email,
            password: credentials.password
          },
          {
            params: buildFieldParams(userPublic)
          }
        );

        const payload = extractData<Record<string, unknown>>(response.data);
        if (payload && typeof payload === "object" && (payload as { next?: unknown }).next === "2fa_required") {
          const challengePayload = payload as {
            method?: unknown;
            session_hint?: unknown;
            user_id?: unknown;
            available_methods?: unknown;
          };
          const sessionHint = String(challengePayload.session_hint ?? "").trim();
          return {
            status: "mfa_required",
            method: String(challengePayload.method ?? "totp"),
            sessionHint,
            userId:
              challengePayload.user_id !== undefined && challengePayload.user_id !== null
                ? String(challengePayload.user_id)
                : undefined,
            availableMethods: Array.isArray(challengePayload.available_methods)
              ? (challengePayload.available_methods as unknown[]).map((entry) => String(entry))
              : undefined
          };
        }

        const { accessToken, refreshToken } = extractTokens(payload);
        updateTokens({
          accessToken,
          refreshToken,
          persist: Boolean(credentials.remember)
        });
        setSessionExpired(false);

        let normalized: AuthUser | null = null;
        if (payload && typeof payload === "object" && "user" in payload) {
          normalized = mapUserResource((payload as { user: unknown }).user);
          setUserState(normalized);
          queryClient.setQueryData(["me"], normalized);
        } else {
          normalized = await bootstrapMe();
        }

        return { status: "authenticated", user: normalized };
      } catch (error) {
        throw new Error(
          resolveApiErrorMessage(
            error,
            "We could not sign you in as an admin. Check your credentials and try again."
          )
        );
      }
    },
    [bootstrapMe, queryClient, setUserState, updateTokens]
  );

  const logout = useCallback(async () => {
    setSessionExpired(false);
    const refreshToken = tokensRef.current.refreshToken;
    try {
      if (refreshToken) {
        await api.post("/auth/logout", { refresh_token: refreshToken });
      }
    } catch {
      // Ignore logout failures; clearing local state is sufficient
    } finally {
      clearTokens(false);
    }
  }, [clearTokens]);

  const refresh = useCallback(async () => {
    const access = await performRefresh();
    if (access) {
      setSessionExpired(false);
    }
    return access;
  }, [performRefresh]);

  const verifyTwoFactor = useCallback(
    async ({ method, sessionHint, code }: VerifyTwoFactorInput): Promise<LoginSuccess> => {
      try {
        const response = await api.post("/auth/2fa/verify", {
          method,
          session_hint: sessionHint,
          code
        });

        const payload = extractData<Record<string, unknown>>(response.data);
        const { accessToken, refreshToken } = extractTokens(payload);
        updateTokens({
          accessToken,
          refreshToken,
          persist: rememberRef.current
        });
        setSessionExpired(false);

        let normalized: AuthUser | null = null;
        if (payload && typeof payload === "object" && "user" in payload) {
          normalized = mapUserResource((payload as { user: unknown }).user);
          setUserState(normalized);
          queryClient.setQueryData(["me"], normalized);
        } else {
          normalized = await bootstrapMe();
        }

        return { status: "authenticated", user: normalized };
      } catch (error) {
        throw new Error(resolveApiErrorMessage(error, "We could not verify the code."));
      }
    },
    [bootstrapMe, queryClient, setUserState, updateTokens]
  );

  const expireSession = useCallback(() => {
    clearTokens(true);
  }, [clearTokens]);

  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);

  const roles = useMemo(() => user?.roles ?? [], [user]);
  const permissions = useMemo(() => user?.permissions ?? [], [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      roles,
      permissions,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isAuthenticated: Boolean(tokens.accessToken),
      hasRefreshToken: Boolean(tokens.refreshToken),
      isBootstrapping,
      sessionExpired,
      loginClientProvider,
      loginAdmin,
      verifyTwoFactor,
      logout,
      refresh,
      bootstrapMe,
      clearSessionExpired,
      expireSession
    }),
    [
      user,
      roles,
      permissions,
      tokens.accessToken,
      tokens.refreshToken,
      isBootstrapping,
      sessionExpired,
      loginClientProvider,
      loginAdmin,
      verifyTwoFactor,
      logout,
      refresh,
      bootstrapMe,
      clearSessionExpired,
      expireSession
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
