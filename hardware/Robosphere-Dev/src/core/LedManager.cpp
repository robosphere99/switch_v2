#include "core/LedManager.h"

#include <Arduino.h>

#include "Config.h"

static bool ledState = false;

static LedManager::Mode currentMode = LedManager::OFF;

static uint8_t step = 0;

static unsigned long previousMillis = 0;

static bool ledEnabled = true;

namespace LedManager
{

bool begin()
{
    pinMode(STATUS_LED_PIN, OUTPUT);

    return true;
}



void update()
{
    if(!ledEnabled){
    if(currentMode != SETUP &&
       currentMode != SERVER_ERROR &&
       currentMode != ON)
    {
        digitalWrite(STATUS_LED_PIN, LOW);
        return;
    }
    }
    unsigned long now = millis();

    switch(currentMode)
    {
        case OFF:

            digitalWrite(STATUS_LED_PIN, LOW);

            break;

        case ON:

            digitalWrite(STATUS_LED_PIN, HIGH);

            break;

        case HEARTBEAT:

            if(now - previousMillis >= (ledState ? 100 : 900))
            {
                previousMillis = now;

                ledState = !ledState;

                digitalWrite(STATUS_LED_PIN, ledState);
            }

            break;

        case SETUP:

            if(now - previousMillis >= 150)
            {
                previousMillis = now;

                ledState = !ledState;

                digitalWrite(STATUS_LED_PIN, ledState);
            }

            break;

        case WIFI_CONNECTING:

            switch(step)
            {
                case 0:
                    digitalWrite(STATUS_LED_PIN, HIGH);
                    previousMillis = now;
                    step = 1;
                    break;

                case 1:
                    if(now-previousMillis>120)
                    {
                        digitalWrite(STATUS_LED_PIN, LOW);
                        previousMillis=now;
                        step=2;
                    }
                    break;

                case 2:
                    if(now-previousMillis>120)
                    {
                        digitalWrite(STATUS_LED_PIN,HIGH);
                        previousMillis=now;
                        step=3;
                    }
                    break;

                case 3:
                    if(now-previousMillis>120)
                    {
                        digitalWrite(STATUS_LED_PIN,LOW);
                        previousMillis=now;
                        step=4;
                    }
                    break;

                case 4:
                    if(now-previousMillis>1200)
                    {
                        step=0;
                    }
                    break;
            }

            break;

        case SERVER_ERROR:

            switch(step)
            {
                case 0:
                    digitalWrite(STATUS_LED_PIN,HIGH);
                    previousMillis=now;
                    step=1;
                    break;

                case 1:
                    if(now-previousMillis>120)
                    {
                        digitalWrite(STATUS_LED_PIN,LOW);
                        previousMillis=now;
                        step=2;
                    }
                    break;

                case 2:
                    if(now-previousMillis>120)
                    {
                        digitalWrite(STATUS_LED_PIN,HIGH);
                        previousMillis=now;
                        step=3;
                    }
                    break;

                case 3:
                    if(now-previousMillis>120)
                    {
                        digitalWrite(STATUS_LED_PIN,LOW);
                        previousMillis=now;
                        step=4;
                    }
                    break;

                case 4:
                    if(now-previousMillis>120)
                    {
                        digitalWrite(STATUS_LED_PIN,HIGH);
                        previousMillis=now;
                        step=5;
                    }
                    break;

                case 5:
                    if(now-previousMillis>120)
                    {
                        digitalWrite(STATUS_LED_PIN,LOW);
                        previousMillis=now;
                        step=6;
                    }
                    break;

                case 6:
                    if(now-previousMillis>1500)
                    {
                        step=0;
                    }
                    break;
            }

            break;
    }
}

void setMode(Mode mode)
{
    currentMode = mode;

    previousMillis = 0;

    step = 0;

    ledState = false;

    digitalWrite(STATUS_LED_PIN, LOW);
}
void enable()
{
    ledEnabled = true;
}

void disable()
{
    ledEnabled = false;
    digitalWrite(STATUS_LED_PIN, LOW);
}

bool isEnabled()
{
    return ledEnabled;
}

}