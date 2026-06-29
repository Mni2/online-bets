let API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";
if (API_URL && !API_URL.startsWith("http://") && !API_URL.startsWith("https://")) {
  API_URL = `https://${API_URL}`;
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  accessToken?: string;
}

export const api = async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.accessToken) headers.authorization = `Bearer ${options.accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const json = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const err = new Error((json as any)?.error?.message ?? `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return json as T;
};

const safeJson = (s: string): unknown => {
  try { return JSON.parse(s); } catch { return undefined; }
};

export const adminStore = {
  get(): { access: string | null } {
    return {
      access: typeof window !== "undefined" ? window.localStorage.getItem("nova.admin.access") : null,
    };
  },
  set(access: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("nova.admin.access", access);
  },
  clear(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("nova.admin.access");
  },
};
