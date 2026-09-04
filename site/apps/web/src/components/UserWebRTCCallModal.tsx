import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";
import { Phone, PhoneOff } from "lucide-react";
import { api } from "../api/client";
import { JitsiCall } from "./calling/JitsiCall";
import { useAuthStore } from "../stores/auth";

export function UserWebRTCCallModal() {
  const [callData, setCallData] = useState<{ 
    callId: number; 
    roomId: string; 
    token: string; 
    domain: string; 
    callType: 'audio' | 'video'; 
    callerName: string;
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "incoming" | "connected">("idle");
  const user = useAuthStore((s: any) => s.user);

  useEffect(() => {
    const socket = getSocket();

    const handleSignal = (data: any) => {
      const { type, payload } = data;

      if (type === "call-request") {
        setCallData({
          callId: payload.callId,
          roomId: payload.roomId,
          token: "", // Will be fetched on accept
          domain: "",
          callType: payload.callType || "video",
          callerName: payload.callerName || "Support",
        });
        setStatus("incoming");
      }
      else if (type === "call-end") {
        cleanup();
      }
    };

    socket.on("webrtc:signal", handleSignal);
    return () => {
      socket.off("webrtc:signal", handleSignal);
    };
  }, []);

  const acceptCall = async () => {
    if (!callData) return;
    try {
      const res = await api.post(`/support/calls/${callData.callId}/accept`);
      setCallData({
        ...callData,
        token: res.data.jitsiToken,
        domain: res.data.domain,
      });
      setStatus("connected");
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message;
      alert("Failed to accept call: " + (typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg));
      cleanup();
    }
  };

  const rejectCall = async () => {
    if (callData) {
      try {
        await api.post(`/support/calls/${callData.callId}/reject`);
      } catch (err) {
        console.error("Failed to reject call API", err);
      }
    }
    cleanup();
  };

  const endCall = async () => {
    if (callData) {
      try {
        await api.post(`/support/calls/${callData.callId}/end`);
      } catch (err) {
        console.error("Failed to end call API", err);
      }
    }
    cleanup();
  };

  const cleanup = () => {
    setCallData(null);
    setStatus("idle");
  };

  if (!callData) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-night-900 border border-night-800 rounded-2xl w-full max-w-4xl overflow-hidden flex flex-col shadow-2xl relative">
        {status === "incoming" ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-20 h-20 rounded-full bg-brand/20 flex items-center justify-center mb-6 animate-pulse">
              <Phone className="text-brand h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{callData.callerName} is Calling</h2>
            <p className="text-gray-400 mb-8 text-center max-w-md">
              SwitchNest Support is requesting an <strong className="text-white">{callData.callType === 'audio' ? 'Audio' : 'Video'} Call</strong> to help you troubleshoot.
            </p>
            
            <div className="flex gap-6">
              <button 
                onClick={rejectCall}
                className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center"
                title="Decline"
              >
                <PhoneOff size={28} />
              </button>
              <button 
                onClick={acceptCall}
                className="w-16 h-16 rounded-full bg-green-500 text-white hover:brightness-110 transition flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                title="Accept"
              >
                <Phone size={28} />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-night-800 bg-night-950">
              <h2 className="text-white font-semibold">Support Call with {callData.callerName}</h2>
            </div>

            {/* Video Area */}
            <div className="relative bg-black h-[70vh] w-full flex items-center justify-center">
              <JitsiCall
                roomId={callData.roomId}
                domain={callData.domain}
                token={callData.token || undefined}
                callType={callData.callType}
                userInfo={{
                  displayName: user?.username || "User",
                  email: user?.email,
                }}
                onReadyToClose={endCall}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
