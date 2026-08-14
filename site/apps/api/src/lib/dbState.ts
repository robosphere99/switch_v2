/**
 * DB ready state — setup mode (install pending) me non-install routes
 * 503 dete hain. Install success ke baad resetPrismaClient() + setDbReady(true)
 * se server turant normal chalta hai (restart ki zaroorat nahi).
 */
let ready = false;

export function setDbReady(value: boolean) {
  ready = value;
}

export function isDbReady() {
  return ready;
}
