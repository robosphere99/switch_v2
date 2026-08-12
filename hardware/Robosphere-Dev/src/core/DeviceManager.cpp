#include <Arduino.h>

#include "core/DeviceManager.h"

static Device devices[MAX_DEVICES];

static int deviceCount = 0;

namespace DeviceManager
{

void clear()
{
    deviceCount = 0;
}

bool addDevice(
    int id,
    const char *name,
    const char *status)
{
    if(deviceCount >= MAX_DEVICES)
        return false;

    devices[deviceCount].id = id;

    strlcpy(
        devices[deviceCount].name,
        name,
        sizeof(devices[deviceCount].name));

    strlcpy(
        devices[deviceCount].status,
        status,
        sizeof(devices[deviceCount].status));

    deviceCount++;

    return true;
}

int getCount()
{
    return deviceCount;
}

Device *getDevice(int index)
{
    if(index < 0)
        return nullptr;

    if(index >= deviceCount)
        return nullptr;

    return &devices[index];
}

}