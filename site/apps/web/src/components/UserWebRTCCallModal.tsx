import { useEffect, useState, useRef } from "react";
import { getSocket } from "../lib/socket";
import { Phone, PhoneOff, Mic, MicOff, Video, UserRound, Settings } from "lucide-react";

export function UserWebRTCCallModal() {
  const [callData, setCallData] = useState<{ senderId: number, callType: 'audio' | 'video' } | null>(null);
  const [status, setStatus] = useState<"idle" | "incoming" | "connected">("idle");
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const sendSignal = (targetId: number, type: string, payload: any) => {
    const socket = getSocket();
    socket.emit("webrtc:signal", { targetId, type, payload });
  };

  useEffect(() => {
    // Fetch available devices
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
      setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
    }).catch(console.error);
  }, []);

  const cleanup = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setCallData(null);
    setStatus("idle");
    setAudioMuted(false);
    setVideoMuted(false);
  };

  const initWebRTC = async (targetId: number, type: "audio" | "video") => {
    // Basic STUN server
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(targetId, "webrtc-ice", e.candidate);
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    try {
      const constraints: MediaStreamConstraints = { 
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true, 
        video: type === "video" 
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
      }
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
    } catch (e) {
      console.error("Camera/Mic access failed", e);
      alert("Camera or Microphone access denied. Cannot connect.");
      cleanup();
      return false;
    }
    
    // Set speaker if selected
    if (selectedSpeaker && remoteVideoRef.current && typeof (remoteVideoRef.current as any).setSinkId === "function") {
      (remoteVideoRef.current as any).setSinkId(selectedSpeaker).catch(console.error);
    }
    
    return true;
  };

  const acceptCall = async () => {
    if (!callData) return;
    setStatus("connected");
    const success = await initWebRTC(callData.senderId, callData.callType);
    if (success) {
      sendSignal(callData.senderId, "call-accept", {});
    }
  };

  const rejectCall = () => {
    if (callData) {
      sendSignal(callData.senderId, "call-reject", {});
    }
    cleanup();
  };

  const endCall = () => {
    if (callData) {
      sendSignal(callData.senderId, "call-end", {});
    }
    cleanup();
  };

  useEffect(() => {
    const socket = getSocket();

    const handleSignal = async (data: any) => {
      const { senderId, type, payload } = data;

      if (type === "call-request") {
        const callType = payload?.callType || "video";
        setCallData({ senderId, callType });
        setStatus("incoming");
        sendSignal(senderId, "call-ringing", {});
      }
      else if (type === "call-end") {
        cleanup();
      }
      else if (type === "webrtc-offer") {
        if (pcRef.current) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            sendSignal(senderId, "webrtc-answer", answer);
          } catch (e) {
            console.error("Error creating answer", e);
          }
        }
      }
      else if (type === "webrtc-ice") {
        if (pcRef.current && payload) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload));
          } catch (e) {}
        }
      }
      else if (type === "remote-command") {
        if (payload?.command === "switch-camera") {
          // No rear camera on most PCs, so just ignore or show an alert
          console.log("Admin requested camera switch, but Web doesn't support multiple cameras natively yet.");
        }
      }
    };

    socket.on("webrtc:signal", handleSignal);
    return () => {
      socket.off("webrtc:signal", handleSignal);
    };
  }, []);

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      setAudioMuted(!localStreamRef.current.getAudioTracks()[0].enabled);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      if (localStreamRef.current.getVideoTracks().length > 0) {
        setVideoMuted(!localStreamRef.current.getVideoTracks()[0].enabled);
      }
    }
  };

  const changeMic = async (deviceId: string) => {
    setSelectedMic(deviceId);
    if (localStreamRef.current && pcRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
        const newTrack = stream.getAudioTracks()[0];
        
        // Stop old track
        const oldTrack = localStreamRef.current.getAudioTracks()[0];
        if (oldTrack) oldTrack.stop();
        
        // Update local stream
        localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(newTrack);
        
        // Replace track in peer connection
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === "audio");
        if (sender) sender.replaceTrack(newTrack);
        
        // Keep mute state
        newTrack.enabled = !audioMuted;
      } catch (err) {
        console.error("Failed to change mic", err);
      }
    }
  };

  const changeSpeaker = async (deviceId: string) => {
    setSelectedSpeaker(deviceId);
    if (remoteVideoRef.current && typeof (remoteVideoRef.current as any).setSinkId === "function") {
      try {
        await (remoteVideoRef.current as any).setSinkId(deviceId);
      } catch (err) {
        console.error("Failed to change speaker", err);
      }
    }
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
            <h2 className="text-2xl font-bold text-white mb-2">Support is Calling</h2>
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
              <h2 className="text-white font-semibold">Support Call in Progress</h2>
            </div>

            {/* Video Area */}
            <div className="relative bg-black h-[60vh] w-full flex items-center justify-center">
              {callData.callType === "video" ? (
                <video 
                  ref={remoteVideoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full">
                  <div className="w-24 h-24 bg-night-800 rounded-full flex items-center justify-center mb-4">
                    <UserRound className="h-12 w-12 text-gray-500" />
                  </div>
                  <p className="text-gray-300 font-medium">Audio Call in progress</p>
                </div>
              )}
              {callData.callType === "video" && (
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="absolute bottom-4 right-4 w-32 h-48 bg-night-800 rounded-lg border-2 border-night-700 object-cover shadow-lg"
                />
              )}
            </div>

            {/* Controls */}
            <div className="p-4 bg-night-950 flex flex-wrap items-center justify-center gap-6 relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition shadow-lg ${showSettings ? 'bg-brand text-white' : 'bg-night-800 text-white hover:bg-night-700'}`}
                title="Device Settings"
              >
                <Settings size={24} />
              </button>

              {showSettings && (
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-72 bg-night-900 border border-night-700 p-4 rounded-xl shadow-xl z-50">
                  <h4 className="text-white font-semibold mb-3">Audio Settings</h4>
                  
                  <div className="mb-3">
                    <label className="text-xs text-gray-400 mb-1 block">Microphone</label>
                    <select 
                      className="w-full bg-night-800 border border-night-700 text-white text-sm rounded-lg p-2 focus:border-brand focus:outline-none"
                      value={selectedMic}
                      onChange={(e) => changeMic(e.target.value)}
                    >
                      <option value="">Default Microphone</option>
                      {audioDevices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || 'Unknown Mic'}</option>
                      ))}
                    </select>
                  </div>
                  
                  {outputDevices.length > 0 && (
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Speaker</label>
                      <select 
                        className="w-full bg-night-800 border border-night-700 text-white text-sm rounded-lg p-2 focus:border-brand focus:outline-none"
                        value={selectedSpeaker}
                        onChange={(e) => changeSpeaker(e.target.value)}
                      >
                        <option value="">Default Speaker</option>
                        {outputDevices.map(d => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label || 'Unknown Speaker'}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <button 
                onClick={toggleMic}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition shadow-lg ${audioMuted ? 'bg-red-500 text-white' : 'bg-night-800 text-white hover:bg-night-700'}`}
                title={audioMuted ? "Unmute" : "Mute"}
              >
                {audioMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>

              {callData.callType === "video" && (
                <button 
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition shadow-lg ${videoMuted ? 'bg-red-500/20 text-red-500' : 'bg-night-800 text-white hover:bg-night-700'}`}
                  title={videoMuted ? "Turn on Camera" : "Turn off Camera"}
                >
                  <Video size={24} />
                </button>
              )}

              <button 
                onClick={endCall}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white transition shadow-lg flex items-center justify-center ml-8"
                title="End Call"
              >
                <PhoneOff size={24} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

