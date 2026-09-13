import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Mic, ExternalLink } from "lucide-react";

export function VoiceAssistants() {
  const [connections] = useState<any[]>([]);

  const handleDisconnect = async (provider: string) => {
    if (!window.confirm(`Are you sure you want to disconnect ${provider}?`)) return;
    alert(`${provider} disconnected successfully!`);
  };

  const isGoogleConnected = !!connections.find((c) => c.provider === "google");
  const isAlexaConnected = !!connections.find((c) => c.provider === "alexa");

  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Voice Assistants
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Connect your SwitchNest account to Amazon Alexa or Google Home for hands-free voice control.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Google Home Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/30 p-2.5">
                  <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#F9AB00" fillOpacity="0.1" />
                    <path d="M21.3533 10.4285H12V14.1953H17.48C17.24 15.4208 16.2733 16.4442 14.8933 17.159V19.4627H18.12C19.9867 17.653 21.0533 15.0652 21.0533 12.0125C21.0533 11.464 21.1467 10.9238 21.3533 10.4285Z" fill="#4285F4" />
                    <path d="M4.60673 13.9213L1.5134 16.3218C3.3934 20.0822 7.3734 22.0002 12.0001 22.0002C14.5467 22.0002 16.8934 21.129 18.1201 19.4628L14.8934 17.1592C14.1067 17.697 13.12 18.0163 12.0001 18.0163C9.56006 18.0163 7.50006 16.3248 6.78673 13.9213H4.60673V13.9213Z" fill="#34A853" />
                    <path d="M6.78667 10.9325C6.54667 11.6663 6.54667 12.4578 6.78667 13.9213L3.69334 16.3218C2.96 14.8698 2.53334 13.2505 2.53334 11.5302C2.53334 10.1502 2.84 8.8118 3.41334 7.60068L5.78667 9.45035L6.78667 10.9325Z" fill="#FBBC05" />
                    <path d="M12 5.9839C13.56 5.9839 14.8933 6.54141 15.9333 7.42435L18.4267 4.931C16.88 3.40939 14.7333 2.5 12 2.5C7.37333 2.5 3.38667 5.12214 1.50667 9.24355L4.6 11.644C5.32 9.2405 7.37333 5.9839 12 5.9839Z" fill="#EA4335" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Google Assistant</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Google Home app integration</p>
                </div>
              </div>
              <Badge variant={isGoogleConnected ? "success" : "neutral"} dot={isGoogleConnected}>
                {isGoogleConnected ? "Connected" : "Available"}
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              Say <span className="font-semibold text-slate-900 dark:text-white">"Hey Google, turn on living room lights"</span> or set up automation routines with Google Home.
            </p>

            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/50 mb-6 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-800 dark:text-slate-200">Quick Pairing Steps:</div>
              <ol className="list-decimal list-inside space-y-1 text-slate-500 dark:text-slate-400">
                <li>Open the Google Home app on your phone</li>
                <li>Tap <b>Devices</b> &rarr; <b>Add</b> &rarr; <b>Works with Google</b></li>
                <li>Search for <b>SwitchNest</b> and log in with your credentials</li>
              </ol>
            </div>
          </div>

          <div>
            {isGoogleConnected ? (
              <Button
                variant="danger"
                onClick={() => handleDisconnect("google")}
                className="w-full"
              >
                Disconnect Google Home
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled
                className="w-full"
                rightIcon={<ExternalLink className="h-4 w-4" />}
              >
                Link via Google Home App
              </Button>
            )}
          </div>
        </div>

        {/* Amazon Alexa Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-950/30 text-sky-500 font-bold text-xl">
                  <Mic className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Amazon Alexa</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Alexa Smart Home Skill</p>
                </div>
              </div>
              <Badge variant={isAlexaConnected ? "success" : "neutral"} dot={isAlexaConnected}>
                {isAlexaConnected ? "Connected" : "Available"}
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              Say <span className="font-semibold text-slate-900 dark:text-white">"Alexa, turn off bedroom fan"</span> or control multi-channel smart switches with your Echo devices.
            </p>

            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/50 mb-6 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-800 dark:text-slate-200">Quick Pairing Steps:</div>
              <ol className="list-decimal list-inside space-y-1 text-slate-500 dark:text-slate-400">
                <li>Open the Amazon Alexa mobile app</li>
                <li>Go to <b>Skills & Games</b> &rarr; Search <b>SwitchNest</b></li>
                <li>Tap <b>Enable to Use</b> and sign in to link accounts</li>
              </ol>
            </div>
          </div>

          <div>
            {isAlexaConnected ? (
              <Button
                variant="danger"
                onClick={() => handleDisconnect("alexa")}
                className="w-full"
              >
                Disconnect Alexa
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled
                className="w-full"
                rightIcon={<ExternalLink className="h-4 w-4" />}
              >
                Link via Alexa Skill Store
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
