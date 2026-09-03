import re

with open('src/core/MqttManager.cpp', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add extern declaration at the top
if 'extern void processSerialCommand' not in content:
    content = content.replace('#include "core/Logger.h"', '#include "core/Logger.h"\n\nextern void processSerialCommand(const String &line, bool fromMqtt = false);')

# 2. Replace the term_cmd block
old_block = """  } else if (String(topic) == "sn/" + mac + "/term_cmd") {
    // Process terminal commands
    String cmd = message;
    cmd.trim();
    publishLog(">> " + cmd);
    
    if (cmd == "ping") {
      publishLog("pong");
    } else if (cmd == "reboot") {
      publishLog("Rebooting in 1 second...");
      delay(1000);
      ESP.restart();
    } else if (cmd == "wifi_status") {
      publishLog("WiFi: " + WiFi.SSID() + " | IP: " + WiFi.localIP().toString() + " | RSSI: " + String(WiFi.RSSI()));
    } else if (cmd == "fw_version") {
      publishLog("FW Version: " + String(FIRMWARE_VERSION));
    } else {
      publishLog("Unknown command: " + cmd);
    }
  }"""
new_block = """  } else if (String(topic) == "sn/" + mac + "/term_cmd") {
    // Process terminal commands via main serial command processor
    String cmd = message;
    cmd.trim();
    publishLog(">> " + cmd);
    processSerialCommand(cmd, true);
  }"""

if old_block in content:
    content = content.replace(old_block, new_block)
else:
    print("Warning: old block not found! Trying regex.")
    content = re.sub(r'  } else if \(String\(topic\) == "sn/" \+ mac \+ "/term_cmd"\) \{.*?(?=  \}\n  \n  void publishLog)', new_block, content, flags=re.DOTALL)

with open('src/core/MqttManager.cpp', 'w', encoding='utf-8') as f:
    f.write(content)

print("MqttManager.cpp refactored")
