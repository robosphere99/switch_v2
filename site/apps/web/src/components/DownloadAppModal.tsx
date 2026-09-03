import { useState, useEffect } from "react";
import { Smartphone, Download, X } from "lucide-react";

export function DownloadAppModal({ onClose }: { onClose: () => void }) {
  const [lanIp, setLanIp] = useState<string | null>(null);

  useEffect(() => {
    // If accessed on localhost or 127.0.0.1, fetch machine LAN IP so QR code works for devices on the same WiFi
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      fetch("/api/public/lan-ip")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.ip && data.ip !== "127.0.0.1") {
            setLanIp(data.ip);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Determine effective host for QR code and direct download
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const effectiveHost = isLocalhost
    ? (lanIp ? `${lanIp}:${window.location.port || 5173}` : window.location.host)
    : window.location.hostname;

  const apkProtocol = window.location.protocol;
  const apkUrl = `${apkProtocol}//${effectiveHost}/mobile-app/SwitchNest_Latest.apk`;
  
  // Use a simple public API to generate the QR code image without relying on heavy Node packages
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(apkUrl)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-night-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute right-3 top-3">
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition dark:hover:bg-night-700 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Smartphone className="h-8 w-8" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-night-950 dark:text-white">
            Get the SwitchNest App
          </h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Control your smart home from anywhere. Scan the QR code or download the APK directly to install it on your Android device.
          </p>

          <div className="mb-6 flex justify-center">
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-night-600 dark:bg-night-900">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Code for App Download" className="h-[180px] w-[180px]" />
              ) : (
                <div className="flex h-[180px] w-[180px] items-center justify-center text-gray-400">
                  Generating...
                </div>
              )}
            </div>
          </div>

          <a
            href={apkUrl}
            download="SwitchNest_Latest.apk"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white shadow-md shadow-brand/30 transition hover:bg-brand-600 hover:brightness-110"
          >
            <Download className="h-5 w-5" />
            Download APK
          </a>
        </div>
      </div>
    </div>
  );
}
