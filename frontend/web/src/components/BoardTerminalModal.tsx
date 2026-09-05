import React, { useState, useEffect, useRef } from "react";
import { getSocket } from "../lib/socket";

interface BoardTerminalModalProps {
  espId: number;
  mac: string;
  isOpen: boolean;
  onClose: () => void;
}

interface LogEntry {
  id: string;
  time: string;
  text: string;
}

export function BoardTerminalModal({ espId, mac, isOpen, onClose }: BoardTerminalModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cmd, setCmd] = useState("");
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !espId) return;
    
    const socket = getSocket();

    // Clear logs on open
    setLogs([{
      id: "init",
      time: new Date().toLocaleTimeString([], { hour12: false }),
      text: `Connecting to board terminal [MAC: ${mac}]...`
    }]);
    
    // Subscribe
    socket.emit("admin:subscribe-logs", { espId });

    // Listener
    const handleLog = (log: string) => {
      setLogs((prev) => [...prev, {
        id: Math.random().toString(36).substring(7),
        time: new Date().toLocaleTimeString([], { hour12: false }),
        text: log
      }]);
    };
    
    socket.on("admin:board-log", handleLog);

    return () => {
      socket.emit("admin:unsubscribe-logs", { espId });
      socket.off("admin:board-log", handleLog);
    };
  }, [isOpen, espId, mac]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmd.trim()) return;
    
    // Echo locally so we know we sent it
    setLogs((prev) => [...prev, {
      id: Math.random().toString(36).substring(7),
      time: new Date().toLocaleTimeString([], { hour12: false }),
      text: `[Admin] Sending: ${cmd.trim()}`
    }]);
    
    getSocket().emit("admin:send-cmd", { espId, cmd: cmd.trim() });
    setCmd("");
  };

  const handleCopyLogs = () => {
    const textToCopy = logs.map(l => `[${l.time}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  if (!isOpen) return null;

  const COMMAND_GUIDE = [
    { label: "ping", desc: "Check connection (returns pong)" },
    { label: "fw_version", desc: "Check running firmware version" },
    { label: "wifi_status", desc: "Get WiFi SSID, IP, and Signal Strength (RSSI)" },
    { label: "info", desc: "Get full diagnostic info (MAC, IP, FW, Model)" },
    { label: "export", desc: "Export current device configuration" },
    { label: "reboot", desc: "Restart the ESP32 board" },
    { label: "factoryreset", desc: "Wipe all settings (WiFi, Serial, etc) and reboot" },
    { label: "help", desc: "List all configuration commands" },
    { label: "testrelay", desc: "Run a self-test cycling through all relays" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-xl border border-gray-700 bg-gray-900 shadow-2xl flex flex-col h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-3 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <h3 className="font-mono text-sm font-semibold text-gray-200">Terminal - ESP #{espId}</h3>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleCopyLogs}
              className="text-xs font-mono px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              {copied ? "Copied!" : "Copy Logs"}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Logs Window */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-green-400 leading-relaxed bg-black scrollbar-thin scrollbar-thumb-gray-700">
          {logs.map((l) => (
            <div key={l.id} className="break-words mb-1 flex gap-3 hover:bg-gray-900/50 py-0.5 px-1 -mx-1 rounded">
              <span className="text-gray-500 select-none shrink-0">[{l.time}]</span>
              <span className={l.text.startsWith(">>") || l.text.startsWith("[Admin]") ? "text-yellow-400" : "text-green-400"}>
                {l.text}
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Preset Commands Guide */}
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex flex-col gap-2 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
          <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Command Guide</div>
          <div className="grid grid-cols-2 gap-2">
            {COMMAND_GUIDE.map((cmdItem) => (
              <button
                key={cmdItem.label}
                type="button"
                onClick={() => setCmd(cmdItem.label)}
                className="flex flex-col items-start text-left bg-gray-700/50 hover:bg-gray-600 border border-gray-600 hover:border-green-500/50 rounded px-2 py-1.5 transition-colors group"
              >
                <span className="text-[11px] font-mono text-gray-200 group-hover:text-green-400">{cmdItem.label}</span>
                <span className="text-[10px] text-gray-400 leading-tight">{cmdItem.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-700 bg-gray-800 p-3 rounded-b-xl">
          <form onSubmit={handleSend} className="flex gap-2">
            <span className="text-green-500 font-mono flex items-center justify-center pl-2">&gt;</span>
            <input
              type="text"
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              placeholder="Enter command (e.g., ping, reboot, wifi_status)"
              className="flex-1 bg-gray-900 text-green-400 font-mono text-sm border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-green-500 transition-colors placeholder-gray-600"
              autoFocus
            />
            <button
              type="submit"
              disabled={!cmd.trim()}
              className="bg-green-600/20 text-green-500 border border-green-500/50 hover:bg-green-600/30 font-semibold px-4 py-2 rounded transition-colors disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
