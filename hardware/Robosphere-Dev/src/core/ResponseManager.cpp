#include "core/ResponseManager.h"

#include <ArduinoJson.h>

namespace ResponseManager
{

String success(const String &message)
{
    DynamicJsonDocument doc(512);

    doc["success"] = true;
    doc["message"] = message;

    String json;

    serializeJson(doc, json);

    return json;
}

String error(const String &message)
{
    DynamicJsonDocument doc(512);

    doc["success"] = false;
    doc["message"] = message;

    String json;

    serializeJson(doc, json);

    return json;
}

String success(const String &message,
               const String &data)
{
    DynamicJsonDocument doc(512);

    doc["success"] = true;
    doc["message"] = message;

    doc["data"] = serialized(data);

    String json;

    serializeJson(doc, json);

    return json;
}

}