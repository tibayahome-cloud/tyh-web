const CHALLENGE_KEY = "tiba.auth.twofa.challenge";
const FLAG_KEY = "tiba.auth.twofa_enabled";

export type StoredTwofaChallenge = {
  method: string;
  sessionHint: string;
  userId?: string;
  origin: "client" | "provider" | "admin";
  methods?: string[];
};

const safeWindow = () => (typeof window === "undefined" ? null : window);

export const saveTwofaChallenge = (challenge: StoredTwofaChallenge): void => {
  const win = safeWindow();
  if (!win) {
    return;
  }
  try {
    win.localStorage.setItem(
      CHALLENGE_KEY,
      JSON.stringify({
        method: challenge.method,
        sessionHint: challenge.sessionHint,
        userId: challenge.userId,
        origin: challenge.origin,
        methods: challenge.methods
      })
    );
    win.localStorage.setItem(FLAG_KEY, "true");
  } catch {
    /* ignore */
  }
};

export const readTwofaChallenge = (): StoredTwofaChallenge | null => {
  const win = safeWindow();
  if (!win) {
    return null;
  }
  try {
    const raw = win.localStorage.getItem(CHALLENGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredTwofaChallenge;
    if (!parsed?.sessionHint || !parsed?.method) {
      return null;
    }
    return {
      method: parsed.method,
      sessionHint: parsed.sessionHint,
      userId: parsed.userId,
      origin: parsed.origin ?? "client",
      methods: Array.isArray(parsed.methods) ? parsed.methods : undefined
    };
  } catch {
    return null;
  }
};

export const updateTwofaChallenge = (updates: Partial<StoredTwofaChallenge>): void => {
  const win = safeWindow();
  if (!win) {
    return;
  }
  try {
    const current = readTwofaChallenge();
    if (!current) {
      return;
    }
    const next: StoredTwofaChallenge = {
      ...current,
      ...updates,
      methods: updates.methods ?? current.methods
    };
    saveTwofaChallenge(next);
  } catch {
    /* ignore */
  }
};

export const clearTwofaChallenge = (): void => {
  const win = safeWindow();
  if (!win) {
    return;
  }
  try {
    win.localStorage.removeItem(CHALLENGE_KEY);
  } catch {
    /* ignore */
  }
};

export const setTwofaPendingFlag = (pending: boolean): void => {
  const win = safeWindow();
  if (!win) {
    return;
  }
  try {
    if (pending) {
      win.localStorage.setItem(FLAG_KEY, "true");
    } else {
      win.localStorage.removeItem(FLAG_KEY);
    }
  } catch {
    /* ignore */
  }
};

export const isTwofaPending = (): boolean => {
  const win = safeWindow();
  if (!win) {
    return false;
  }
  try {
    return win.localStorage.getItem(FLAG_KEY) === "true";
  } catch {
    return false;
  }
};
