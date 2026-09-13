import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { safeStorage } from "../lib/safeStorage";
import { Card } from "../components/ui/Card";
import { CardContent } from "../components/ui/CardContent";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { CheckCircle2, Home as HomeIcon, Zap, ArrowRight, Lock } from "lucide-react";

export function OAuthConsent() {
  const [searchParams] = useSearchParams();
  const [homes, setHomes] = useState<any[]>([]);
  const [selectedHome, setSelectedHome] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clientId = searchParams.get("client_id") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";
  const state = searchParams.get("state") || "";

  const isGoogle = redirectUri.includes("google") || clientId.toLowerCase().includes("google");
  const providerName = isGoogle ? "Google Home" : "Amazon Alexa";

  useEffect(() => {
    try {
      const savedHomes = JSON.parse(safeStorage.getItem("homes") || "[]");
      setHomes(savedHomes);
      if (savedHomes.length > 0) {
        setSelectedHome(String(savedHomes[0].id || savedHomes[0].homeId));
      }
    } catch {
      setHomes([]);
    }
  }, []);

  const handleAllow = async () => {
    if (!selectedHome) {
      setError("Please select a home first to grant access.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${safeStorage.getItem("accessToken") || ""}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          state: state,
          homeId: parseInt(selectedHome, 10),
          provider: isGoogle ? "google" : "alexa",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Authorization failed");
      }

      window.location.href = data.data.redirectUrl;
    } catch (err: any) {
      setError(err.message || "Failed to authorize integration");
      setLoading(false);
    }
  };

  const handleDeny = () => {
    try {
      const url = new URL(redirectUri);
      url.searchParams.append("state", state);
      url.searchParams.append("error", "access_denied");
      window.location.href = url.toString();
    } catch {
      window.close();
    }
  };

  return (
    <div className="page-enter flex min-h-[90vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* App connection pill */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/25">
            <Zap className="h-6 w-6" />
          </div>
          <ArrowRight className="h-5 w-5 text-text-muted" />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-elevated border border-border text-text-primary shadow-sm font-bold text-sm">
            {isGoogle ? "G" : "A"}
          </div>
        </div>

        <Card className="shadow-xl">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center">
              <h2 className="text-xl font-bold text-text-primary">
                Link with {providerName}
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                <span className="font-semibold text-text-primary">{providerName}</span> is requesting permission to control hardware in your SwitchNest account.
              </p>
            </div>

            {error && (
              <div className="mt-4">
                <Alert variant="danger" title="Authorization Error" onClose={() => setError("")}>
                  {error}
                </Alert>
              </div>
            )}

            {/* Permissions list */}
            <div className="mt-6 rounded-2xl border border-border/60 bg-surface-secondary/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                Requested Capabilities
              </p>
              <ul className="space-y-2.5 text-xs text-text-secondary">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Discover and view hardware devices in your selected home.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Execute voice commands to toggle switches and adjust states.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Read real-time online status and power consumption.</span>
                </li>
              </ul>
            </div>

            {/* Home selector */}
            <div className="mt-6">
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                <HomeIcon className="h-3.5 w-3.5" />
                Select Home to Grant Access
              </label>
              {homes.length > 0 ? (
                <select
                  value={selectedHome}
                  onChange={(e) => setSelectedHome(e.target.value)}
                  className="w-full rounded-xl border border-border/80 bg-surface-primary px-3.5 py-2.5 text-sm font-medium text-text-primary shadow-xs outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  {homes.map((home: any) => (
                    <option key={home.id || home.homeId} value={home.id || home.homeId}>
                      {home.name || `Home #${home.id || home.homeId}`}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                  No configured homes found. Please create or join a home in SwitchNest before linking with {providerName}.
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={handleAllow}
                loading={loading}
                disabled={homes.length === 0}
                className="w-full justify-center"
              >
                Allow Access
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={handleDeny}
                disabled={loading}
                className="w-full justify-center text-text-muted hover:text-text-primary"
              >
                Cancel and Return
              </Button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-text-muted">
              <Lock className="h-3 w-3" />
              <span>Secured by standard OAuth 2.0 authorization</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
