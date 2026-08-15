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
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
