#pragma once

#include <Arduino.h>

// Shared page skeleton helpers (glassmorphism UI):
//   uiHead(title)     - full <head> + stylesheet link
//   uiNav(active)     - glass navbar (active = current page path) + container open
//   uiAuthBegin()     - login/setup page wrapper (floating theme toggle + centered)
//   uiEnd()           - close container + app.js + </body></html>
String uiHead(const String &title);

String uiNav(const String &active);

String uiAuthBegin();

String uiEnd();
