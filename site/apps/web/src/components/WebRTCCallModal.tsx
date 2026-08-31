import { useEffect, useState, useRef } from "react";
import { getSocket } from "../lib/socket";
import { X, PhoneOff, Mic, MicOff, Smartphone, MonitorSmartphone, Video, UserRound, Settings } from "lucide-react";

export function WebRTCCallModal() {
  const [peerId, setPeerId] = useState<number | null>(null);
  const [callType, setCallType] = useState<"audio" | "video">("video");
  const [status, setStatus] = useState<"idle" | "calling" | "ringing" | "connected">("idle");
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

  // Initialize and handle modal open
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
    // Fetch available devices
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
      setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
    }).catch(console.error);
  }, []);

  const sendSignal = (type: string, payload: any) => {
    if (!peerId) return;
    const socket = getSocket();
    socket.emit("webrtc:signal", { targetId: peerId, type, payload });
  };

  const startCall = async (id: number, type: "audio" | "video") => {
    setStatus("calling");
    const socket = getSocket();
    socket.emit("webrtc:signal", { targetId: id, type: "call-request", payload: { callType: type } });
  };

  const endCall = () => {
    sendSignal("call-end", {});
    cleanup();
  };

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
    setPeerId(null);
    setStatus("idle");
    setAudioMuted(false);
    setVideoMuted(false);
  };

  const initWebRTC = async () => {
    // Basic STUN server
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal("webrtc-ice", e.candidate);
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    // Get Admin Audio/Video
    try {
      const constraints: MediaStreamConstraints = { 
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true, 
        video: callType === "video" 
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current && callType === "video") {
        localVideoRef.current.srcObject = stream;
      }
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
    } catch (e) {
      console.warn("No admin media access", e);
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }
    
    // Always add a video transceiver so that if the user starts screen-sharing during an audio call,
    // the WebRTC connection is already prepared to receive video.
    pc.addTransceiver('video', { direction: 'recvonly' });

    // Set speaker if selected
    if (selectedSpeaker && remoteVideoRef.current && typeof (remoteVideoRef.current as any).setSinkId === "function") {
      (remoteVideoRef.current as any).setSinkId(selectedSpeaker).catch(console.error);
    }

    // Create Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal("webrtc-offer", offer);
  };

  useEffect(() => {
    if (!peerId) return;
    const socket = getSocket();

    const handleSignal = async (data: any) => {
      const { senderId, type, payload } = data;
      if (senderId !== peerId) return;

      if (type === "call-ringing") {
        setStatus("ringing");
      }
      else if (type === "call-accept") {
        setStatus("connected");
        initWebRTC();
      }
      else if (type === "call-reject") {
        alert("User rejected the call");
        cleanup();
      }
      else if (type === "call-end") {
        cleanup();
      }
      else if (type === "webrtc-answer") {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
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
        if (payload.command === "switch-call-type") {
          setCallType(payload.callType);
        }
      }
    };

    socket.on("webrtc:signal", handleSignal);
    return () => {
      socket.off("webrtc:signal", handleSignal);
    };
  }, [peerId]);

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      setAudioMuted(!localStreamRef.current.getAudioTracks()[0].enabled);
    }
  };

  const toggleVideo = async () => {
    if (callType === "audio" && !localStreamRef.current?.getVideoTracks().length) {
       // If currently audio and admin wants to turn on video, capture it
       try {
           const stream = await navigator.mediaDevices.getUserMedia({ video: true });
           const newVideoTrack = stream.getVideoTracks()[0];
           localStreamRef.current?.addTrack(newVideoTrack);
           
           if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
           
           if (pcRef.current) {
               const sender = pcRef.current.getSenders().find(s => s.track?.kind === "video");
               if (sender) {
                   sender.replaceTrack(newVideoTrack);
               } else {
                   pcRef.current.addTrack(newVideoTrack, localStreamRef.current!);
               }
           }
       } catch (err) {
           console.error("Could not capture video", err);
           return;
       }
    }

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      if (localStreamRef.current.getVideoTracks().length > 0) {
        const newMuted = !localStreamRef.current.getVideoTracks()[0].enabled;
        setVideoMuted(newMuted);
        const newType = newMuted ? "audio" : "video";
        setCallType(newType);
        sendCommand("switch-call-type", { callType: newType });
      }
    }
  };

  const sendCommand = (cmd: string, payload: any = {}) => {
    sendSignal("remote-command", { command: cmd, ...payload });
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
        <div className="relative bg-black h-[60vh] w-full flex items-center justify-center">
          {status !== "connected" ? (
            <div className="text-center animate-pulse flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-brand/20 flex items-center justify-center mb-4">
                <PhoneOff className="text-brand h-8 w-8" />
              </div>
              <p className="text-brand font-medium tracking-widest uppercase text-sm">
                {status === "calling" ? "Calling..." : "Ringing..."}
              </p>
            </div>
          ) : (
            <>
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className={`w-full h-full object-contain ${callType === "video" ? 'block' : 'hidden'}`}
              />
              {callType === "audio" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black w-full h-full z-10">
                  <div className="w-24 h-24 bg-night-800 rounded-full flex items-center justify-center mb-4">
                    <UserRound className="h-12 w-12 text-gray-500" />
                  </div>
                  <p className="text-gray-300 font-medium">Audio Call in progress</p>
                </div>
              )}
              
              <video 
                ref={localVideoRef} 
                autoPlay 
                muted 
                playsInline 
                className={`absolute bottom-4 right-4 w-32 h-48 bg-night-800 rounded-lg border-2 border-night-700 object-cover shadow-lg z-20 ${callType === "video" ? 'block' : 'hidden'}`}
              />
            </>
          )}
        </div>

        {/* Controls */}
        {status === "connected" && (
          <div className="p-4 bg-night-950 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              {callType === "video" && (
                <>
                  <button 
                    onClick={() => sendCommand("switch-camera")}
                    className="flex items-center gap-2 px-4 py-2 bg-night-800 hover:bg-night-700 text-white rounded-lg transition"
                  >
                    <Smartphone size={16} /> Switch Camera
                  </button>
                  <button 
                    onClick={() => sendCommand("screen-share")}
                    className="flex items-center gap-2 px-4 py-2 bg-night-800 hover:bg-night-700 text-white rounded-lg transition"
                  >
                    <MonitorSmartphone size={16} /> Request Screen Share
                  </button>
                </>
              )}
              
              <button 
                onClick={toggleVideo}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${videoMuted || callType === 'audio' ? 'bg-red-500/20 text-red-500' : 'bg-night-800 text-white hover:bg-night-700'}`}
              >
                <Video size={16} /> {videoMuted || callType === 'audio' ? 'Video Off' : 'Video On'}
              </button>
            </div>

            <div className="flex gap-3 relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition ${showSettings ? 'bg-brand text-white' : 'bg-night-800 text-white hover:bg-night-700'}`}
                title="Device Settings"
              >
                <Settings size={20} />
              </button>
              
              {showSettings && (
                <div className="absolute bottom-16 right-0 w-64 bg-night-900 border border-night-700 p-4 rounded-xl shadow-xl z-50">
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
                className={`w-12 h-12 rounded-full flex items-center justify-center transition ${audioMuted ? 'bg-red-500 text-white' : 'bg-night-800 text-white hover:bg-night-700'}`}
              >
                {audioMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button 
                onClick={endCall}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-full transition shadow-lg"
              >
                End Call
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
