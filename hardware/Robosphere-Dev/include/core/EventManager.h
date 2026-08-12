#pragma once

#include <Arduino.h>

#include <functional>

namespace EventManager
{

using EventCallback = std::function<void(const Event&)>;

void begin();

void registerListener(EventCallback callback);

void trigger(const Event& event);

}