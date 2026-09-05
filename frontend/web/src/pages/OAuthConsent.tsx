import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { safeStorage } from "../lib/safeStorage";


export function OAuthConsent() {
    const [searchParams] = useSearchParams();
    const [homes, setHomes] = useState<any[]>([]);
    const [selectedHome, setSelectedHome] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const clientId = searchParams.get("client_id") || "";
    const redirectUri = searchParams.get("redirect_uri") || "";
    const state = searchParams.get("state") || "";


    // Very simplistic check: determine provider from client ID or redirect URI
    const isGoogle = redirectUri.includes("google");
    const provider = isGoogle ? "google" : "alexa";
    const providerName = isGoogle ? "Google Home" : "Amazon Alexa";

    useEffect(() => {
        // In a real application, you'd fetch the user's homes from the API and populate the array
        const savedHomes = JSON.parse(safeStorage.getItem("homes") || "[]");
        setHomes(savedHomes);
        if (savedHomes.length > 0) {
            setSelectedHome(savedHomes[0].id);
        }
    }, []);

    const handleAllow = async () => {
        if (!selectedHome) {
            setError("Please select a home first.");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch("/api/oauth/authorize", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // Including authorization Bearer token natively if your app does it, else use API client
                    "Authorization": `Bearer ${safeStorage.getItem("accessToken")}`
                },
                body: JSON.stringify({
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    state: state,
                    homeId: parseInt(selectedHome, 10),
                    provider: provider
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || "Authorization failed");
            }

            // Backend returns the formed redirectUrl with code and state. Navigate to it.
            window.location.href = data.data.redirectUrl;

        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleDeny = () => {
        const url = new URL(redirectUri);
        url.searchParams.append("state", state);
        url.searchParams.append("error", "access_denied");
        window.location.href = url.toString();
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-800 p-8 shadow-xl text-center">
                <h2 className="text-2xl font-bold mb-6">Link Your Account</h2>

                <p className="text-gray-300 mb-6 font-medium">
                    <strong className="text-white">{providerName}</strong> is requesting access to control your SwitchNest devices.
                </p>

                {error && (
                    <div className="mb-4 rounded-md bg-red-900/50 border border-red-500/50 p-3 text-sm text-red-200">
                        {error}
                    </div>
                )}

                <div className="mb-8 text-left">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Select Home to Link</label>
                    {homes.length > 0 ? (
                        <select
                            value={selectedHome}
                            onChange={(e) => setSelectedHome(e.target.value)}
                            className="w-full rounded-md border border-gray-600 bg-gray-700 p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            {homes.map((home: any) => (
                                <option key={home.id} value={home.id}>{home.name}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="rounded-md border border-yellow-700/50 bg-yellow-900/30 p-3 text-sm text-yellow-200">
                            No homes found. You need a setup SwitchNest Home to link with {providerName}.
                        </div>
                    )}
                </div>

                <div className="flex flex-col space-y-4">
                    <button
                        onClick={handleAllow}
                        disabled={loading || homes.length === 0}
                        className="w-full rounded-md bg-blue-600 p-3 font-bold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                    >
                        {loading ? "Linking..." : "Allow Access"}
                    </button>

                    <button
                        onClick={handleDeny}
                        disabled={loading}
                        className="w-full rounded-md border border-gray-600 bg-transparent p-3 font-semibold text-gray-300 hover:bg-gray-700 transition disabled:opacity-50"
                    >
                        Deny
                    </button>
                </div>

                <p className="mt-8 text-xs text-gray-500">
                    By clicking Allow, you authorize SwitchNest to share device states and accept commands from {providerName}.
                </p>
            </div>
        </div>
    );
}
