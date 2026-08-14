#pragma once

#include <Arduino.h>
#include "Config.h"

struct Device
{
    int id;

    char name[50];

    char status[10];
};

namespace DeviceManager
{
    void clear();

    bool addDevice(
        int id,
        const char *name,
        const char *status
    );

    int getCount();

    Device *getDevice(int index);
}