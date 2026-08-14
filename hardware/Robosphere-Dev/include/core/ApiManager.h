#pragma once

#include <Arduino.h>

namespace ApiManager
{
    bool testConnection();

    bool downloadDevices();

    bool updateDevice(int deviceId, bool state);

    // Debounced batched push — short interval ke multiple updates
    // ek saath (batch) server pe jaate hain. Same device ke duplicate
    // toggles coalesce ho kar sirf latest state push karte hain.
    bool queueDeviceUpdate(int deviceId, bool state);

    // Command queue (v2): server pe web/API se kiya gaya toggle pending
    // command banke aata hai. Isse fetch karke relays pe apply karte hain
    // aur ack bhejte hain.
    bool downloadCommands();

    // Heartbeat: device online report (IP + firmware + actual relay states)
    // + OTA push check. Agar admin ne is device ko update push kiya hai to
    // `otaUrl` firmware .bin URL se bhar jata hai — caller update trigger kare.
    bool heartbeat(String &otaUrl);

    bool ackCommand(int commandId, int deviceId, bool ok);

    // Main loop se har cycle call karo — pending updates ko flush karta hai
    void update();
}