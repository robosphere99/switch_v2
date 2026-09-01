import axios from "axios";
import { useAuthStore } from "../stores/auth";

export const api = axios.create({
  baseURL: "/api",
  timeout: 10_000,
});

// Attach the JWT access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Support attachment URL — naya storage: file disk pe, URL me token query (img src ke liye).
 *  Legacy rows (attachmentData blob) ke liye null → component base64 data-URL use karta hai. */
export function getAttachmentUrl(msg: {
  id: number;
  attachmentPath?: string | null;
}): string | null {
  if (!msg.attachmentPath) return null;
  const token = useAuthStore.getState().accessToken ?? "";
  return `/api/support/attachment/${msg.id}?token=${encodeURIComponent(token)}`;
}

// On 401, clear the local session (refresh rotation comes in a later phase).
api.interceptors.response.use(
  (res) => {
    // If IIS/iisnode returns an HTML error page with a 200 OK status, reject it!
    if (typeof res.data === "string" && res.data.trim().startsWith("<")) {
      return Promise.reject(new Error("API returned HTML instead of JSON. Server might be crashing."));
    }
    return res;
  },
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

/**
 * Kisi bhi API error se readable message nikalta hai. Kabhi-kabhi proxy/IIS
 * JSON error ko HTML page se replace kar deta hai — tab fallback message dekar
 * raw HTML ko UI me dikhne se rokta hai.
 */
export function extractApiError(err: unknown): { status: number; message: string; code: string; details?: any } {
  const e = err as { response?: { status?: number; data?: unknown } };
  const status = e.response?.status ?? 0;
  const data = e.response?.data;
  if (data && typeof data === "object" && (data as { success?: boolean }).success === false) {
    const apiErr = (data as { error?: { code?: string; message?: string; details?: any } }).error;
    if (apiErr?.message) return { status, message: apiErr.message, code: apiErr.code ?? "ERROR", details: apiErr.details };
  }
  if (status >= 400) {
    // App ka JSON error nahi mila (HTML/proxy page) — generic friendly message
    return { status, message: `Request failed (HTTP ${status}) — server ka error page aaya. Thodi der baad try karo.`, code: "HTTP_ERROR" };
  }
  return { status, message: "Connection error. Is the API running?", code: "NETWORK" };
}
