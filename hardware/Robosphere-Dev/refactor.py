import re
import os

with open('src/main.cpp', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add consolePrint helper before processSerialCommand
helper = """
void consolePrint(const String& msg) {
  Serial.println(msg);
  MqttManager::publishLog(msg);
}
"""
if "void consolePrint" not in content:
    content = content.replace('void processSerialCommand', helper + '\nvoid processSerialCommand')

# 2. Modify signature of processSerialCommand
if 'void processSerialCommand(const String &line, bool fromMqtt)' not in content:
    content = content.replace('void processSerialCommand(const String &line) {', 'void processSerialCommand(const String &line, bool fromMqtt = false) {')

# 3. Bypass lock check if fromMqtt
lock_check_old = """
  if (!serialUnlocked) {
    Serial.println("🔒 [ERR] Console locked. Use 'unlock <password>'");
    return;
  }
"""
lock_check_new = """
  if (!serialUnlocked && !fromMqtt) {
    Serial.println("🔒 [ERR] Console locked. Use 'unlock <password>'");
    return;
  }
"""
if lock_check_old in content:
    content = content.replace(lock_check_old, lock_check_new)

# 4. Replace Serial.println inside processSerialCommand with consolePrint
# We need to only replace it inside the function body.
# Let's find the start and end of processSerialCommand.
start_idx = content.find('void processSerialCommand')
end_idx = content.find('void handleSerialConfig()')

if start_idx != -1 and end_idx != -1:
    func_body = content[start_idx:end_idx]
    new_func_body = func_body.replace('Serial.println(', 'consolePrint(')
    content = content[:start_idx] + new_func_body + content[end_idx:]

with open('src/main.cpp', 'w', encoding='utf-8') as f:
    f.write(content)

print("main.cpp refactored")
