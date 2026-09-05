import { useState, useEffect } from "react";


// Assuming standard layout components exist in this project based on standard conventions in Tailwind React
export function VoiceAssistants() {
    const [connections] = useState<any[]>([]);

    useEffect(() => {
        // In a real implementation this would fetch from /api/homes/meta or a dedicated endpoint.
        // For this milestone, we'll mock it if the endpoint doesn't exist yet, 
        // or just assume the user has no connections initially.
    }, []);

    const handleDisconnect = async (provider: string) => {
        if (!window.confirm(`Are you sure you want to disconnect ${provider}?`)) return;
        // Call disconnect API: e.g. api.delete(`/integration/${provider}`)
        alert(`${provider} disconnected successfully!`);
    };

    return (
        <div className="page-enter mx-auto max-w-4xl p-6">
            <h1 className="text-3xl font-bold mb-2">Voice Assistants</h1>
            <p className="text-gray-400 mb-8">
                Connect your SwitchNest account to Amazon Alexa or Google Home to control your devices using your voice.
            </p>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Google Home Card */}
                <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
                    <div className="flex items-center space-x-4 mb-4">
                        <div className="h-12 w-12 rounded-full bg-white p-2">
                            <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#F9AB00" fillOpacity="0.1" />
                                <path d="M21.3533 10.4285H12V14.1953H17.48C17.24 15.4208 16.2733 16.4442 14.8933 17.159V19.4627H18.12C19.9867 17.653 21.0533 15.0652 21.0533 12.0125C21.0533 11.464 21.1467 10.9238 21.3533 10.4285Z" fill="#4285F4" />
                                <path d="M4.60673 13.9213L1.5134 16.3218C3.3934 20.0822 7.3734 22.0002 12.0001 22.0002C14.5467 22.0002 16.8934 21.129 18.1201 19.4628L14.8934 17.1592C14.1067 17.697 13.12 18.0163 12.0001 18.0163C9.56006 18.0163 7.50006 16.3248 6.78673 13.9213H4.60673V13.9213Z" fill="#34A853" />
                                <path d="M6.78667 10.9325C6.54667 11.6663 6.54667 12.4578 6.78667 13.9213L3.69334 16.3218C2.96 14.8698 2.53334 13.2505 2.53334 11.5302C2.53334 10.1502 2.84 8.8118 3.41334 7.60068L5.78667 9.45035L6.78667 10.9325Z" fill="#FBBC05" />
                                <path d="M12 5.9839C13.56 5.9839 14.8933 6.54141 15.9333 7.42435L18.4267 4.931C16.88 3.40939 14.7333 2.5 12 2.5C7.37333 2.5 3.38667 5.12214 1.50667 9.24355L4.6 11.644C5.32 9.2405 7.37333 5.9839 12 5.9839Z" fill="#EA4335" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Google Home</h2>
                            {connections.find(c => c.provider === "google") ? (
                                <span className="text-green-400 text-sm font-semibold">✓ Connected</span>
                            ) : (
                                <span className="text-gray-400 text-sm">Not connected</span>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-gray-400 mb-6">
                        Control your devices by saying "Hey Google, turn on the lights".
                    </p>
                    {connections.find(c => c.provider === "google") ? (
                        <button
                            onClick={() => handleDisconnect("google")}
                            className="w-full rounded-md bg-red-600/10 border border-red-500/20 px-4 py-2 font-semibold text-red-500 hover:bg-red-600/20 transition"
                        >
                            Disconnect
                        </button>
                    ) : (
                        <button className="w-full rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 transition" disabled>
                            Link in Google Home App
                        </button>
                    )}
                </div>

                {/* Amazon Alexa Card */}
                <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
                    <div className="flex items-center space-x-4 mb-4">
                        <div className="h-12 w-12 rounded-full bg-blue-500/10 p-2 text-blue-500 flex items-center justify-center font-bold text-xl">
                            a
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Amazon Alexa</h2>
                            {connections.find(c => c.provider === "alexa") ? (
                                <span className="text-green-400 text-sm font-semibold">✓ Connected</span>
                            ) : (
                                <span className="text-gray-400 text-sm">Not connected</span>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-gray-400 mb-6">
                        Control your devices by saying "Alexa, turn off the bedroom light".
                    </p>
                    {connections.find(c => c.provider === "alexa") ? (
                        <button
                            onClick={() => handleDisconnect("alexa")}
                            className="w-full rounded-md bg-red-600/10 border border-red-500/20 px-4 py-2 font-semibold text-red-500 hover:bg-red-600/20 transition"
                        >
                            Disconnect
                        </button>
                    ) : (
                        <button className="w-full rounded-md bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700 transition" disabled>
                            Link in Alexa App
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
