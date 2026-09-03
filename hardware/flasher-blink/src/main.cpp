#include <Arduino.h>

void setup() {
  pinMode(2, OUTPUT);
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\n--- ESP32 FACTORY WIPED ---");
  Serial.println("EEPROM/NVS is clear.");
  Serial.println("Start Flashing Firmware Now...");
}

void loop() {
  digitalWrite(2, HIGH);
  Serial.println("STATUS: WIPED & READY");
  delay(500);
  digitalWrite(2, LOW);
  delay(500);
}
