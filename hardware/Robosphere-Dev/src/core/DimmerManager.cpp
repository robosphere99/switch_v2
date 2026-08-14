#include "core/DimmerManager.h"
#include "core/BoardManager.h"
#include "core/RelayManager.h"
#include "preferences/PreferencesManager.h"
#include "Config.h"

namespace DimmerManager
{
    static uint8_t steps = 0;

    static const char *stepKey(uint8_t channel)
    {
        static char key[8];
        snprintf(key, sizeof(key), "dim%u", channel);
        return key;
    }

    void begin()
    {
        steps = BoardManager::getDimmerSteps();
    }

    uint8_t getSteps()
    {
        return steps;
    }

    bool isDimmer()
    {
        return steps > 0;
    }

    uint8_t getStep(uint8_t channel)
    {
        int v = PreferencesManager::getInt(stepKey(channel), 0);
        return v < 0 || v > steps ? 0 : (uint8_t)v;
    }

    uint8_t cycle(uint8_t channel)
    {
        uint8_t next = getStep(channel) + 1;
        if (next > steps)
            next = 0;
        applyStep(channel, next);
        return next;
    }

    void applyStep(uint8_t channel, uint8_t step)
    {
        if (step > steps)
            step = 0;
        PreferencesManager::putInt(stepKey(channel), step);
        RelayManager::setState(channel, step > 0);
    }

    String getStepPercent(uint8_t channel)
    {
        uint8_t s = getStep(channel);
        if (s == 0)
            return "0";
        // 4S: 1->33, 2->66, 3->100   |   3S: 1->50, 2->100
        if (steps == 4)
        {
            const char *map4[] = {"0", "33", "66", "100"};
            return String(map4[s > 3 ? 3 : s]);
        }
        const char *map3[] = {"0", "50", "100"};
        return String(map3[s > 2 ? 2 : s]);
    }
}
