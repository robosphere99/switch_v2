#include "core/WiFiScanner.h"

#include <WiFi.h>

namespace WiFiScanner
{

String getNetworkOptions()
{
    String html;

    int count = WiFi.scanNetworks();

    if(count <= 0)
    {
        html += "<option value=''>No Networks Found</option>";

        return html;
    }

    for(int i = 0; i < count; i++)
    {
        html += "<option value='";

        html += WiFi.SSID(i);

        html += "'>";

        html += WiFi.SSID(i);

        html += " (";

        html += WiFi.RSSI(i);

        html += " dBm)";

        if(WiFi.encryptionType(i) == WIFI_AUTH_OPEN)
        {
            html += " 🔓";
        }
        else
        {
            html += " 🔒";
        }

        html += "</option>";
    }

    return html;
}

}