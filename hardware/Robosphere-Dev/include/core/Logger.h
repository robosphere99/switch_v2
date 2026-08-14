#pragma once

namespace Logger
{
    void begin(long baudRate = 115200);

    void info(const char *message);

    void success(const char *message);

    void warning(const char *message);

    void error(const char *message);

    void api(const char *message);

    void wifi(const char *message);

    void system(const char *message);
}