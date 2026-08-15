#include "web/UI.h"

String uiHead(const String &title)
{
    String h = "<!DOCTYPE html><html><head>";
    h += "<meta charset=\"UTF-8\">";
    h += "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
    h += "<title>" + title + "</title>";
    h += "<link rel=\"stylesheet\" href=\"/style.css\">";
    h += "</head><body>";
    return h;
}

String uiNav(const String &active)
{
    String n = "<nav class=\"navbar glass\">";
    n += "<a class=\"brand\" href=\"/dashboard\">⚡ SwitchNest</a>";
    n += "<button class=\"nav-toggle\" id=\"navToggle\" aria-label=\"Menu\">☰</button>";
    n += "<div class=\"nav-links\" id=\"navLinks\">";

    struct NavLink
    {
        const char *href;
        const char *label;
    };

    NavLink links[] = {
        {"/dashboard", "Dashboard"},
        {"/server", "Server"},
        {"/mapping", "Mapping"},
        {"/wifi", "WiFi"},
        {"/system", "System"},
        {"/logout", "Logout"}};

    for (uint8_t i = 0; i < 6; i++)
    {
        n += "<a href=\"";
        n += links[i].href;
        n += "\"";

        if (active == links[i].href)
        {
            n += " class=\"active\"";
        }

        n += ">";
        n += links[i].label;
        n += "</a>";
    }

    n += "</div>";
    n += "<button class=\"theme-toggle\" id=\"themeToggle\">🌙</button>";
    n += "</nav><div class=\"container\">";
    return n;
}

String uiAuthBegin()
{
    String b = "<button class=\"theme-toggle floating\" id=\"themeToggle\">🌙</button>";
    b += "<div class=\"auth-wrap\">";
    return b;
}

String uiEnd()
{
    return "</div><script src=\"/app.js\"></script></body></html>";
}
