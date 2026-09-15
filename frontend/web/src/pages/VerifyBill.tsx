import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { Skeleton } from "../components/ui/Skeleton";
import { ShieldCheck, ShieldAlert, CheckCircle2, FileText, Cpu } from "lucide-react";

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      setState({ loading: false, result: null, error: "Verification token missing from URL" });
      return;
    }
    api
      .get(`/public/verify/bill/${encodeURIComponent(token)}`)
      .then(({ data }) => setState({ loading: false, result: data.data as VerifyResult, error: null }))
      .catch(() =>
        setState({ loading: false, result: null, error: "Failed to communicate with verification server." })
      );
  }, [token]);

  const r = state.result;

  return (
    <div className="page-enter mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {state.loading && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Skeleton className="h-8 w-1/2 mx-auto" />
          <Skeleton className="h-4 w-3/4 mx-auto" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      )}

      {state.error && (
        <div className="mb-6">
          <Alert variant="danger">{state.error}</Alert>
        </div>
      )}

      {!state.loading && !state.error && r && !r.verified && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-8 text-center dark:border-rose-900/50 dark:bg-rose-950/30">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-rose-900 dark:text-rose-200">
            Invoice Verification Failed
          </h1>
          <p className="mt-2 text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto leading-relaxed">
            {r.reason === "invalid_token"
              ? "This verification signature is invalid or forged. Official SwitchNest invoices contain tamper-proof cryptographic signatures."
              : "This bill token does not match any record in the SwitchNest registry."}
          </p>
        </div>
      )}

      {!state.loading && !state.error && r?.verified && (
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm dark:border-emerald-900/50 dark:bg-slate-900">
          {/* Verified Header */}
          <div className="border-b border-emerald-100 bg-emerald-50/70 p-6 text-center dark:border-emerald-900/30 dark:bg-emerald-950/30">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-extrabold text-emerald-900 dark:text-emerald-200">
              Authentic SwitchNest Invoice
            </h1>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              Cryptographically verified · Order <b>#{r.orderNumber}</b>
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-800 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shadow-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              HMAC Token Validated
            </div>
          </div>

          {/* Bill Summary */}
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-1 text-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Invoice Information</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">#{r.orderNumber}</p>
              <p className="text-slate-500">Date: {fmtDate(r.createdAt)}</p>
              <div className="pt-1 flex items-center gap-2">
                <span className="text-slate-500">Status:</span>
                <Badge variant={r.status === "delivered" ? "success" : "info"} size="sm">
                  {r.status}
                </Badge>
              </div>
              <p className="text-slate-500">Payment: {r.paymentStatus}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-1 text-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Billed Recipient</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{r.buyer?.name}</p>
              {r.buyer?.username && <p className="text-slate-500">@{r.buyer.username}</p>}
              <div className="pt-2">
                <span className="text-slate-400">Total Billed: </span>
                <span className="text-base font-bold text-slate-900 dark:text-white">{money(r.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="px-6 pb-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Items on Invoice ({r.items?.length ?? 0})
            </p>
            <div className="space-y-2">
              {r.items?.map((i, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{i.productName}</p>
                    <p className="font-mono text-[11px] text-slate-400">{i.serialCode ?? "No serial bound"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-[11px]">Qty: {i.quantity}</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {money((Number(i.price) * i.quantity).toFixed(2))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Serials & Factory Test Verification */}
          {r.serials && r.serials.length > 0 && (
            <div className="px-6 pb-6">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" /> Hardware Quality & Factory Testing Records
              </p>
              <div className="space-y-2.5">
                {r.serials.map((s) => (
                  <div
                    key={s.serialCode}
                    className="rounded-xl border border-slate-200/70 bg-white p-3.5 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-brand">{s.serialCode}</span>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={s.tested ? "success" : "warning"} size="sm">
                          {s.tested ? "Factory Tested" : "Testing Pending"}
                        </Badge>
                        <Badge variant="neutral" size="sm">
                          Warranty: {s.warrantyStatus}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Model: {s.modelCode}
                      {s.testedAt ? ` · Quality Passed: ${fmtDate(s.testedAt).split(",")[0]}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Guarantee Strip */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-4 text-[11px] text-slate-500 leading-relaxed dark:border-slate-800 dark:bg-slate-900/50">
            This verification confirms that the hardware was manufactured and flash-tested directly at SwitchNest facilities. Hardware serial ownership is registered on SwitchNest servers.
          </div>
        </div>
      )}
    </div>
  );
}
