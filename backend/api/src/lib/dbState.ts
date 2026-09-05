/**
 * DB ready state — setup mode (install pending) me non-install routes
 * 503 dete hain. Install success ke baad resetPrismaClient() + setDbReady(true)
 * se server turant normal chalta hai (restart ki zaroorat nahi).
 *
 * Default TRUE (optimistic): Plesk/iisnode churn me naye process har ~60s
 * spawn hote hain — unke DB-probe (~1s) tak ready=false rehta tha to sab
 * requests 503 milti thin. Ab probe hone tak requests direct DB pe jaati
 * hain (installed site pe tables hain, sab theek). Fresh install pe probe
 * false set kar deta hai — installer phir bhi chalega (install/status pre-gate).
 */
let ready = true;

export function setDbReady(value: boolean) {
  ready = value;
}

export function isDbReady() {
  return ready;
}
