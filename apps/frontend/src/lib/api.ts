const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ApiOptions {
  method?: string;
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
  cache?: RequestCache;
}

export const api = async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (options.accessToken) headers.authorization = `Bearer ${options.accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    cache: options.cache ?? "no-store",
  });

  const text = await res.text();
  const json = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const err = new Error((json as any)?.error?.message ?? `HTTP ${res.status}`);
    (err as any).code = (json as any)?.error?.code;
    (err as any).status = res.status;
    throw err;
  }
  return json as T;
};

const safeJson = (s: string): unknown => {
  try { return JSON.parse(s); } catch { return undefined; }
};

export const tokenStore = {
  get(): { access: string | null; refresh: string | null } {
    if (typeof window === "undefined") return { access: null, refresh: null };
    return {
      access: window.localStorage.getItem("nova.access"),
      refresh: window.localStorage.getItem("nova.refresh"),
    };
  },
  set(access: string, refresh: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("nova.access", access);
    window.localStorage.setItem("nova.refresh", refresh);
  },
  clear(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("nova.access");
    window.localStorage.removeItem("nova.refresh");
  },
};
