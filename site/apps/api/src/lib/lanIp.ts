import dgram from "node:dgram";
import os from "node:os";

/**
 * Server ka LAN IP detect karo — flasher GUI ke `detect_lan_ip()` (Python) ka
 * Node version. Board (ESP) ko wahi IP dikhana chahiye jo server chala raha
 * hai — isliye guide page me `<LAN-IP>` placeholder ki jagah asli IP dikhta
 * hai (localhost mode me `http://192.168.x.x:4000`).
 *
 * Strategy (flasher jaisi hi): UDP socket se candidate gateways pe "connect"
 * karke dekh lo kis interface se route jaata hai — connect se remote pe koi
 * packet NAHI jaata (connectionless), bas OS route choose karta hai. Phir
 * hostname/networkInterfaces fallback.
 */
export function detectLanIp(): Promise<string> {
  const candidates = ["192.168.1.1", "192.168.0.1", "10.0.0.1", "172.16.0.1", "8.8.8.8"];

  // Synchronous fallback — network interfaces me pehla non-internal IPv4.
  const fromInterfaces = (): string => {
    for (const ifaces of Object.values(os.networkInterfaces())) {
      for (const iface of ifaces ?? []) {
        if (iface.family === "IPv4" && !iface.internal) return iface.address;
      }
    }
    return "192.168.1.100";
  };

  return new Promise<string>((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= candidates.length) {
        resolve(fromInterfaces());
        return;
      }
      const target = candidates[i++];
      const sock = dgram.createSocket("udp4");
      const fail = () => {
        try {
          sock.close();
        } catch {
          /* ignore */
        }
        tryNext();
      };
      sock.on("error", fail);
      sock.on("connect", () => {
        let ip = "";
        try {
          ip = sock.address().address;
          sock.close();
        } catch {
          /* ignore */
        }
        if (ip && !ip.startsWith("127.")) resolve(ip);
        else tryNext();
      });
      try {
        sock.connect(80, target);
      } catch {
        fail();
      }
    };
    tryNext();
  });
}
