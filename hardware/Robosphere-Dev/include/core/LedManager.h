#pragma once

namespace LedManager
{
    enum Mode
    {
        OFF,
        ON,
        HEARTBEAT,
        SETUP,
        WIFI_CONNECTING,
        SERVER_ERROR
    };

    bool begin();

    void setMode(Mode mode);

    void on();

    void off();

    void toggle();

    void update();

    void blink(unsigned long interval);
    void enable();

    void disable();

    bool isEnabled();

    /** Web panel se toggle — preference me persist hota hai. */
    void setUserEnabled(bool enabled);
}