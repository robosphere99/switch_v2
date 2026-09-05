import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";

interface VerifyResult {
  verified: boolean;
  reason?: string;
  orderNumber?: string;
  createdAt?: string;
  status?: string;
  paymentStatus?: string;
  totalAmount?: string;
  buyer?: { name: string; username: string | null };
  items?: Array<{ productName: string; quantity: number; price: string; serialCode: string | null }>;
  serials?: Array<{
    serialCode: string;
    modelCode: string;
    status: string;
    tested: boolean;
    testedAt: string | null;
    claimedAt: string | null;
    warrantyStatus: string;
  }>;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-600",
  paid: "bg-blue-500/20 text-blue-700",
  shipped: "bg-purple-500/20 text-purple-300",
  delivered: "bg-green-500/20 text-green-700",
  cancelled: "bg-red-500/20 text-red-600",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function money(n: string | undefined): string {
  return "₹" + Number(n ?? 0).toLocaleString("en-IN");
}

export function VerifyBill() {
  const { token } = useParams();
  const [state, setState] = useState<{ loading: boolean; result: VerifyResult | null; error: string | null }>({
    loading: true,
    result: null,
    error: null,
  });

  useEffect(() => {
    if (!token) {
      setState({ loading: false, result: null, error: "Verification link missing" });
      return;
    }
    api
      .get(`/public/verify/bill/${encodeURIComponent(token)}`)
      .then(({ data }) => setState({ loading: false, result: data.data as VerifyResult, error: null }))
      .catch(() => setState({ loading: false, result: null, error: "Verify server se load nahi hua — network check karo" }));
  }, [token]);

  const r = state.result;

  return (
    <div className="page-enter mx-auto max-w-2xl px-4 py-10">
      {/* Header — verified / invalid */}
      {state.loading && (
        <div className="rounded-xl border border-gray-200 bg-night-800 p-6 text-center text-gray-400">
          Bill verify ho raha hai…
        </div>
      )}
      {state.error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center">
          <div className="text-4xl">❌</div>
          <h1 className="mt-2 text-xl font-bold text-red-400">Verification error</h1>
          <p className="mt-1 text-sm text-gray-400">{state.error}</p>
        </div>
      )}
      {!state.loading && !state.error && r && !r.verified && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="mt-2 text-xl font-bold text-red-400">Bill verify nahi hua</h1>
          <p className="mt-1 text-sm text-gray-400">
            {r.reason === "invalid_token"
              ? "Ye verification link genuine nahi hai — QR/token forged ya tampered hai."
              : "Ye bill humare system me nahi mila."}
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Agar ye bill aapko kisi aur se mila hai to dhyan rahe — SwitchNest ka koi official bill aisa nahi dikhega. Support: /support
          </p>
        </div>
      )}

      {!state.loading && !state.error && r?.verified && (
        <div className="overflow-hidden rounded-xl border border-emerald-500/30 bg-night-800">
          {/* Green verified banner */}
          <div className="border-b border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <div className="text-4xl">🛡️</div>
            <h1 className="mt-2 text-2xl font-extrabold text-emerald-400">Bill Verified — Genuine</h1>
            <p className="mt-1 text-sm text-emerald-500/80">
              Ye SwitchNest ka asli bill hai · Order <b>#{r.orderNumber}</b>
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400">
              ✅ HMAC-signed token verified · fake bill ka QR kabhi pass nahi hota
            </div>
          </div>

          {/* Bill summary */}
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-night-900 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Bill</p>
              <p className="mt-1 text-lg font-bold">#{r.orderNumber}</p>
              <p className="text-xs text-gray-500">Date: {fmtDate(r.createdAt)}</p>
              <p className="mt-1 text-xs">
                Status: <span className={`badge rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[r.status ?? ""] ?? "bg-gray-500/20 text-gray-400"}`}>{r.status}</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">Payment: {r.paymentStatus}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-night-900 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Billed To</p>
              <p className="mt-1 font-semibold">{r.buyer?.name}</p>
              {r.buyer?.username && <p className="text-xs text-gray-500">@{r.buyer.username}</p>}
              <p className="mt-2 text-xs text-gray-500">Total: <b className="text-sm text-night-950"> {money(r.totalAmount)}</b></p>
            </div>
          </div>

          {/* Items */}
          <div className="px-6 pb-2">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">Items ({r.items?.length ?? 0})</p>
            <div className="space-y-2">
              {r.items?.map((i, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 bg-night-900 px-4 py-2 text-sm">
                  <div>
                    <p className="font-medium">{i.productName}</p>
                    <p className="font-mono text-[11px] text-gray-500">{i.serialCode ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">x{i.quantity}</p>
                    <p className="font-semibold">{money((Number(i.price) * i.quantity).toFixed(2))}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Serials genuineness + factory tested */}
          {r.serials && r.serials.length > 0 && (
            <div className="px-6 py-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">Product Genuineness & Factory Test</p>
              <div className="space-y-2">
                {r.serials.map((s) => (
                  <div key={s.serialCode} className="rounded-lg border border-gray-200 bg-night-900 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold">{s.serialCode}</span>
                      <span className="flex flex-wrap gap-1.5">
                        {s.tested ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                            ✅ Factory tested {fmtDate(s.testedAt).split(",")[0]}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">⏳ Test pending</span>
                        )}
                        <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-400">🛡️ Genuine · {s.status}</span>
                        {s.claimedAt && (
                          <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-300">🔑 Claimed</span>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {s.modelCode} · Warranty: {s.warrantyStatus}
                      {s.testedAt ? ` · Tested ${fmtDate(s.testedAt)}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 bg-night-900/50 px-6 py-4">
            <p className="text-xs leading-relaxed text-gray-500">
              🔒 Har SwitchNest board factory me <b>flash + relay self-test</b> pass karke ship hota hai — tested serial yahi verify hua hai.
              <br />
              Serial code = ownership proof — warranty claim ke liye serial chahiye. Koi problem ho to support se baat karo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
