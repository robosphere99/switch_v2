import { useRef, useState } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";

export interface JitsiCallProps {
  roomId: string;
  domain: string;
  token?: string; // Optional JWT token for JaaS
  userInfo?: {
    displayName: string;
    email?: string;
  };
  callType: "audio" | "video";
  onReadyToClose?: () => void;
}

export function JitsiCall({ roomId, domain, token, userInfo, callType, onReadyToClose }: JitsiCallProps) {
  const [loading, setLoading] = useState(true);
  const jitsiApiRef = useRef<any>(null);

  return (
    <div className="w-full h-full relative bg-night-950 flex flex-col overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-night-900 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
        </div>
      )}

      <JitsiMeeting
        domain={domain}
        roomName={roomId}
        jwt={token}
        configOverwrite={{
          startWithAudioMuted: false,
          startWithVideoMuted: callType === "audio",
          disableDeepLinking: true, // Don't prompt to download mobile app
          prejoinPageEnabled: false, // Skip prejoin screen
          disableInviteFunctions: true, // No invite button
        }}
        interfaceConfigOverwrite={{
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          DEFAULT_LOGO_URL: "",
          TOOLBAR_BUTTONS: [
            "microphone",
            "camera",
            "closedcaptions",
            "desktop",
            "fullscreen",
            "fodeviceselection",
            "hangup",
            "profile",
            "chat",
            "settings",
            "raisehand",
            "videoquality",
            "filmstrip",
            "shortcuts",
            "tileview",
          ],
        }}
        userInfo={userInfo as any}
        onApiReady={(externalApi) => {
          jitsiApiRef.current = externalApi;
          setLoading(false);

          externalApi.addListener("readyToClose", () => {
            if (onReadyToClose) onReadyToClose();
          });

          // Handle iframe close
          externalApi.addListener("videoConferenceLeft", () => {
            if (onReadyToClose) onReadyToClose();
          });
        }}
        getIFrameRef={(iframeRef) => {
          iframeRef.style.height = "100%";
          iframeRef.style.width = "100%";
        }}
      />
    </div>
  );
}
