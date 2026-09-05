import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";
import { X, PhoneOff } from "lucide-react";
import { api } from "../api/client";
import { JitsiCall } from "./calling/JitsiCall";
import { useAuthStore } from "../stores/auth";

export function WebRTCCallModal() {
  const [peerId, setPeerId] = useState<number | null>(null);
  const [callType, setCallType] = useState<"audio" | "video">("video");
  const [status, setStatus] = useState<"idle" | "calling" | "ringing" | "connected">("idle");
  const [callData, setCallData] = useState<{ callId: number; roomId: string; token: string; domain: string } | null>(null);
  const user = useAuthStore((s: any) => s.user);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const id = typeof detail === 'object' ? detail.userId : detail;
      const type = typeof detail === 'object' && detail.callType ? detail.callType : 'video';
      setPeerId(id);
      setCallType(type);
      startCall(id, type);
    };
    document.addEventListener("open-webrtc", handleOpen);
    return () => document.removeEventListener("open-webrtc", handleOpen);
  }, []);

  useEffect(() => {
    if (!peerId) return;
    const socket = getSocket();

    const handleSignal = (data: any) => {
      const { senderId, type } = data;
      if (senderId !== peerId) return;

      if (type === "call-offline-push-sent" || type === "call-ringing") {
        setStatus("ringing");
      } else if (type === "call-accept") {
        setStatus("connected");
      } else if (type === "call-reject") {
        alert("User rejected the call");
        cleanup();
      } else if (type === "call-end") {
        cleanup();
      }
    };

    socket.on("webrtc:signal", handleSignal);
    return () => {
      socket.off("webrtc:signal", handleSignal);
    };
  }, [peerId]);

  const startCall = async (targetId: number, type: "audio" | "video") => {
    setStatus("calling");
    try {
      const res = await api.post("/support/calls", { targetUserId: Number(targetId), callType: type });
      setCallData({
        callId: res.data.callId,
        roomId: res.data.roomId,
        token: res.data.jitsiToken,
        domain: res.data.domain,
      });
      // Assuming ringing status immediately as backend emitted the request
      setStatus("ringing");
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message;
      alert("Failed to initiate call: " + (typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg));
      cleanup();
    }
  };

  const endCall = async () => {
    if (callData) {
      try {
        await api.post(`/api/support/calls/${callData.callId}/end`);
      } catch (err) {
        console.error("Failed to end call API", err);
      }
    }
    cleanup();
  };

  const cleanup = () => {
    setPeerId(null);
    setStatus("idle");
    setCallData(null);
  };

  if (!peerId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-night-900 border border-night-800 rounded-2xl w-full max-w-4xl overflow-hidden flex flex-col shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-night-800 bg-night-950">
          <h2 className="text-white font-semibold">Support Call (User #{peerId})</h2>
          <button onClick={endCall} className="text-gray-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Video Area */}
        <div className="relative bg-black h-[70vh] w-full flex items-center justify-center">
          {status !== "connected" || !callData ? (
            <div className="text-center animate-pulse flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-brand/20 flex items-center justify-center mb-4">
                <PhoneOff className="text-brand h-8 w-8" />
              </div>
              <p className="text-brand font-medium tracking-widest uppercase text-sm">
                {status === "calling" ? "Initiating Call..." : "Ringing..."}
              </p>
              <button 
                onClick={endCall}
                className="mt-8 px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-full transition shadow-lg"
              >
                Cancel Call
              </button>
            </div>
          ) : (
            <JitsiCall
              roomId={callData.roomId}
              domain={callData.domain}
              token={callData.token || undefined}
              callType={callType}
              userInfo={{
                displayName: user?.username || "Admin",
                email: user?.email,
              }}
              onReadyToClose={endCall}
            />
          )}
        </div>
      </div>
    </div>
  );
}
