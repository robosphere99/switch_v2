/**
 * Safe wrapper for localStorage that gracefully handles SecurityError
 * (e.g. when 3rd party cookies are blocked, iframe restrictions, or privacy shields disable localStorage).
 */
const memoryStore = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Fallback to in-memory store on SecurityError / access denied
    }
    return memoryStore.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fallback to in-memory store on SecurityError / access denied
    }
    memoryStore.set(key, value);
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fallback to in-memory store on SecurityError / access denied
    }
    memoryStore.delete(key);
  },
  clear(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.clear();
        return;
      }
    } catch {
      // Fallback to in-memory store on SecurityError / access denied
    }
    memoryStore.clear();
  },
};
