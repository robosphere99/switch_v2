# SwitchNest — Google Home + Alexa Basic Integration
## Implementation Specification for Coding Agent

**Project:** SwitchNest (RoboSphere v2)  
**Goal:** Add basic Google Home and Amazon Alexa smart-home integration for real device control, without building the automation engine yet.

---

## 1. Objective

Implement a first working integration milestone where an existing SwitchNest user can:

1. Link SwitchNest with Google Home.
2. Link SwitchNest with Amazon Alexa.
3. Authorize access to an existing SwitchNest Home.
4. Let Google/Alexa discover authorized SwitchNest devices.
5. Turn supported devices ON/OFF by voice/app.
6. Read/report the current device state.
7. Unlink the integration safely.

### Out of scope for this phase

Do **not** build:

- SwitchNest automation engine
- IF/THEN rules
- Scenes
- Multi-step automations
- Complex conditions
- AI assistant
- Native mobile app
- Matter integration
- IFTTT integration
- ESP32 firmware rewrite for voice integration
- Firebase/Cloud Functions as required middleware
- A second device-control implementation for Google/Alexa

The first milestone is intentionally small: prove that the SwitchNest device cloud can integrate successfully with Google Home and Alexa.

---

## 2. Existing SwitchNest Architecture

Use the existing architecture. Do not rewrite it.

Current stack:

- React 18 + Vite + TypeScript
- Node.js + Express + TypeScript
- Prisma + MySQL 8
- ESP32 relay hardware
- JWT access + refresh authentication
- Zod validation
- Existing device command system
- Existing Home/member/role permission model
- Existing scheduler
- Existing device state/status model

Important existing rule:

**Devices belong to a Home, not directly to a person.**

The integration must preserve:

- multi-tenancy
- Home isolation
- role permissions
- existing command execution
- audit logs
- current device state handling
- existing ESP32 communication

Do not create a second device-control architecture.

---

## 3. Target Architecture

```text
                         Google Home
                              |
                              |
                           Alexa
                              |
                              v
                    Integration Layer
                    /               \
             Google Adapter     Alexa Adapter
                    \               /
                     \             /
                      v           v
                       Device Service
                            |
                     Command / State
                            |
                           DB
                            |
                          ESP32
```

### Critical rule

Google and Alexa must call the **same SwitchNest Device Service**.

Do not put relay logic directly in Google/Alexa controllers.

Preferred flow:

```text
Google/Alexa
    ↓
resolve linked SwitchNest user
    ↓
resolve authorized Home
    ↓
resolve authorized device
    ↓
existing DeviceService
    ↓
existing command system
    ↓
ESP32
```

This keeps the architecture reusable for the web dashboard, future automation engine, Matter, Home Assistant, etc.

---

## 4. Core Device/Integration Abstraction

Inspect the existing code first.

If equivalent services already exist, reuse them.

Conceptually the integration layer should have access to methods similar to:

```ts
getAuthorizedHomes(userId)
getAuthorizedDevices(userId, homeId)
getDeviceState(userId, deviceId)
executeDeviceCommand(userId, deviceId, command)
reportDeviceState(userId, deviceId)
```

Names must match existing project conventions.

Every method must enforce backend authorization.

Never trust:

- device ID
- home ID
- user ID

from an external request without resolving authorization.

---

## 5. Integration Identity Model

Map external identities to the existing SwitchNest user:

```text
Google Account
     ↓
Google OAuth authorization
     ↓
SwitchNest User
     ↓
SwitchNest Home
     ↓
Authorized Devices
```

and:

```text
Amazon Account
     ↓
Alexa account linking
     ↓
SwitchNest User
     ↓
SwitchNest Home
     ↓
Authorized Devices
```

Do not create a second user profile system.

For the first milestone, keep Home selection simple and safe. If a user has multiple homes, expose only a clearly selected/authorized Home unless the existing UX already supports multi-home integration cleanly.

---

## 6. OAuth / Account Linking

### Google Home

Google Cloud-to-cloud Smart Home requires OAuth 2.0 **authorization-code flow** for account linking.

Official reference:

https://developers.home.google.com/cloud-to-cloud/project/authorization

Required concepts:

- authorization endpoint
- token endpoint
- authorization code
- access token
- refresh token
- consent

Do **not** treat normal "Google Sign-In" as a replacement for Google Smart Home OAuth linking.

### Alexa

Alexa smart-home integrations also require account linking.

Official references:

https://developer.amazon.com/docs/alexaplus/account-linking/account-linking-for-sh-and-other.html

https://developer.amazon.com/docs/alexaplus/account-linking/steps-to-implement-account-linking.html

Alexa uses OAuth 2.0 authorization-code based account linking for smart-home integrations.

---

## 7. Auth Architecture

Inspect existing SwitchNest JWT auth before implementing integration OAuth.

Do not blindly expose normal browser JWT access tokens as external Google/Alexa credentials.

Create a dedicated integration authorization/token layer that maps:

```text
Google/Alexa identity
        ↓
SwitchNest authorization
        ↓
SwitchNest user
```

Use secure short-lived authorization codes and appropriately scoped external access/refresh tokens.

Never store tokens/secrets in plaintext if persistent storage is required.

Never commit secrets.

---

## 8. Database Model

Inspect the current Prisma schema first.

Add only what is actually needed.

Conceptual model:

```text
integration_connections
-----------------------
id
user_id
provider
provider_subject
status
created_at
updated_at
last_used_at
```

Potential token fields, if needed:

```text
access_token_encrypted
refresh_token_encrypted
expires_at
```

Actual schema must follow existing conventions.

Do not duplicate:

- users
- homes
- devices
- device state

An integration connection should point back to an existing SwitchNest user.

---

## 9. Google Home — Basic Integration

Google Cloud-to-cloud supports smart-home intents including:

- `action.devices.SYNC`
- `action.devices.QUERY`
- `action.devices.EXECUTE`

Google also supports proactive state reporting using Report State.

Official docs:

https://developers.home.google.com/cloud-to-cloud

https://developers.home.google.com/cloud-to-cloud/project/authorization

https://developers.home.google.com/cloud-to-cloud/intents/query

### Google SYNC

Return only devices authorized for the linked SwitchNest user/Home.

Initially support simple ON/OFF device types appropriate to the existing hardware, such as light/switch/plug where appropriate.

Do not claim unsupported capabilities.

Use stable external Google device IDs mapped to SwitchNest device IDs.

Never use mutable display names as unique IDs.

---

## 10. Google QUERY

Implement `action.devices.QUERY`.

Flow:

```text
Google QUERY
   ↓
verify access token
   ↓
resolve SwitchNest user
   ↓
resolve authorized Home
   ↓
verify requested devices
   ↓
get current device state
   ↓
return current state/reachability
```

Official docs:

https://developers.home.google.com/cloud-to-cloud/intents/query

A request must never reveal state of a device outside the linked user's authorized Home.

---

## 11. Google EXECUTE

Initial supported actions:

```text
ON
OFF
```

Flow:

```text
Google EXECUTE
      ↓
linked SwitchNest user
      ↓
device authorization
      ↓
DeviceService
      ↓
existing command system
      ↓
ESP32
```

The Google controller must not directly manipulate relay hardware.

---

## 12. Google State Reporting

For the first milestone, implement a reliable state-reporting path using the existing SwitchNest state model.

Google supports Report State.

Reference:

https://developers.home.google.com/cloud-to-cloud/support/faq

Do not build a separate state engine for Google.

Preferred future connection:

```text
ESP32 state update
        ↓
SwitchNest State Service
        ├── Web realtime
        ├── Google Report State
        └── Alexa ChangeReport
```

---

## 13. Alexa — Basic Integration

Alexa Smart Home integrations require:

- smart-home skill/add-on configuration
- account linking
- discovery
- control
- state reporting

Current docs:

https://developer.amazon.com/docs/alexaplus/smarthome/steps-to-build-a-smart-home-skill.html

Amazon currently refers to newer smart-home skills as smart-home add-ons; existing integrations continue to operate.

---

## 14. Alexa Account Linking

Implement OAuth 2.0 authorization-code based account linking.

Desired flow:

```text
Alexa app
  ↓
Enable SwitchNest
  ↓
SwitchNest authorization page
  ↓
User signs in
  ↓
User approves access
  ↓
Authorization code
  ↓
Alexa exchanges code for tokens
```

References:

https://developer.amazon.com/docs/alexaplus/account-linking/account-linking-for-sh-and-other.html

https://developer.amazon.com/en-US/docs/alexa/account-linking/standard-account-linking.html

---

## 15. Alexa Discovery

Alexa must discover only the authorized SwitchNest devices.

Discovery must respect:

- SwitchNest user
- Home authorization
- device permissions
- supported capabilities

Reference:

https://developer.amazon.com/docs/alexaplus/smarthome/test-the-addon-tutorial.html

Do not expose internal/admin-only devices.

---

## 16. Alexa ON/OFF

Initially support:

```text
TurnOn
TurnOff
```

Example:

> Alexa, turn on Bedroom Light.

Flow:

```text
Alexa
  ↓
SwitchNest Alexa endpoint
  ↓
OAuth access token
  ↓
SwitchNest user
  ↓
authorized device
  ↓
DeviceService
  ↓
existing command queue
  ↓
ESP32
```

Alexa must never get direct access to internal device-control endpoints.

---

## 17. Alexa State Reporting

Alexa supports state queries and proactive state changes.

References:

https://developer.amazon.com/docs/alexaplus/smarthome/state-reporting-for-smart-home-addons.html

https://developer.amazon.com/en-IN/docs/alexa/smarthome/test-state.html

First milestone:

- reliable state query/reporting
- connect proactive change reporting to the existing state-event pipeline if practical

Do not create an Alexa-specific polling service.

---

## 18. SwitchNest UI

Add:

```text
Settings
  ↓
Voice Assistants
```

Suggested UI:

```text
Voice Assistants

Google Home
Not connected
[ Connect ]

Amazon Alexa
Not connected
[ Connect ]
```

Connected state:

```text
Google Home
✓ Connected
Home: My Home
Devices shared: 6
[ Disconnect ]
```

Never show:

- OAuth tokens
- client secrets
- access tokens
- refresh tokens
- API keys
- raw integration JSON
- internal device IDs

---

## 19. Basic Test Device

Use one safe test device first:

```text
Device:
Test Light

Room:
Test Room

Capability:
ON/OFF
```

### Google acceptance test

1. Link Google Home.
2. Sync devices.
3. Confirm Test Light appears.
4. Turn ON.
5. Verify ESP32 relay.
6. Verify SwitchNest state.
7. Turn OFF.
8. Verify state again.

### Alexa acceptance test

1. Enable/link Alexa.
2. Discover devices.
3. Confirm Test Light appears.
4. Turn ON.
5. Verify ESP32 relay.
6. Verify SwitchNest state.
7. Turn OFF.
8. Verify state again.

---

## 20. Security

Every external request must follow:

```text
External token
      ↓
SwitchNest user
      ↓
Home membership/authorization
      ↓
Device authorization
      ↓
Command
```

Never:

```text
token + arbitrary device ID → execute
```

without checking ownership/permission.

Do not trust external Home IDs.

Do not leak one user's devices to another.

Use existing backend permission middleware where possible.

Log important integration actions through existing audit conventions.

---

## 21. Public HTTPS Requirement

Google/Alexa cloud services cannot use a localhost-only fulfillment endpoint for real-world integration.

Production integration endpoints must be publicly reachable over HTTPS.

Use existing SwitchNest deployment infrastructure.

Do not redesign deployment for this feature.

Never commit:

- Google client secrets
- Amazon secrets
- OAuth signing secrets
- access tokens
- refresh tokens
- passwords

---

## 22. Cost Constraints

Do not add unnecessary recurring infrastructure.

Do not:

- use IFTTT
- require Firebase Functions
- require AWS Lambda
- add Redis only for this integration
- add another paid database
- add another hosted backend

Prefer:

```text
Google Home
     ↓
existing SwitchNest HTTPS API
     ↓
existing Express services
     ↓
existing DB/command system
     ↓
ESP32
```

and the equivalent Alexa flow.

Platform-specific developer/certification requirements remain separate from SwitchNest infrastructure cost.

---

## 23. Error Handling

Handle:

- invalid token
- expired/revoked authorization
- unknown device
- unauthorized device
- offline device
- unsupported command
- command execution failure
- unavailable backend

Do not expose raw internal exceptions to Google/Alexa.

Map errors to the platform's appropriate response format.

---

## 24. Logging

Use existing structured logging.

Log useful metadata:

```text
provider
request type
user/home reference
device
command
result
latency
error category
```

Never log:

- access token
- refresh token
- client secret
- password

---

## 25. Testing

### Unit tests

Cover:

- authorization-code mapping
- token exchange
- external identity → SwitchNest user mapping
- Home authorization
- device filtering
- ON
- OFF
- unauthorized device rejection
- unknown device rejection
- offline behavior

### Google

Cover:

```text
SYNC
QUERY
EXECUTE ON
EXECUTE OFF
state reporting
invalid token
wrong Home
unknown device
```

### Alexa

Cover:

```text
Discovery
TurnOn
TurnOff
ReportState
ChangeReport if implemented
invalid token
wrong Home
unknown device
```

### Regression

Run:

```text
unit tests
typecheck
lint
production build
```

Existing tests must continue to pass.

---

## 26. Implementation Order

### Step 1
Inspect:

- Prisma schema
- authentication
- DeviceService
- command system
- state system
- Home permissions
- logging
- audit log
- existing API route conventions

### Step 2
Identify or create the shared DeviceService boundary.

### Step 3
Create integration connection model.

### Step 4
Implement secure OAuth authorization-code infrastructure.

### Step 5
Implement Google Home.

### Step 6
Test Google end-to-end.

### Step 7
Implement Alexa using the same DeviceService.

### Step 8
Test Alexa end-to-end.

### Step 9
Add Voice Assistants UI.

### Step 10
Run regression tests/build.

Do not implement future automation features during these steps.

---

# FUTURE ROADMAP — RECORD ONLY, DO NOT IMPLEMENT NOW

## A. Native SwitchNest Automation Engine

The long-term goal is an IFTTT-style system built directly into SwitchNest.

Concept:

```text
WHEN
  trigger

IF
  optional conditions

THEN
  actions
```

Example:

```text
WHEN
Bedroom Motion Detected

IF
Time > 7 PM

THEN
Bedroom Light ON
```

Potential modules:

```text
automation/
  triggerEngine
  conditionEngine
  actionEngine
  automationRunner
  automationRuns
  scheduler
```

Potential entities:

```text
automations
automation_triggers
automation_conditions
automation_actions
automation_runs
```

---

## B. Future Automation Triggers

Potential:

### Device
- ON
- OFF
- online
- offline
- sensor value changed
- motion detected
- temperature threshold
- humidity threshold

### Time
- exact time
- daily
- weekdays
- sunrise
- sunset

### Presence/System
- user arrives home
- user leaves home
- device offline for N minutes

### External
- weather
- webhook
- calendar
- third-party events

---

## C. Future Conditions

Potential condition blocks:

```text
AND
OR
NOT
```

Possible conditions:

- time range
- day of week
- device state
- sensor threshold
- home mode
- another device state
- presence
- previous automation result

Keep initial automation UX simple instead of creating a visual programming language.

---

## D. Future Actions

Potential actions:

- turn ON
- turn OFF
- toggle
- delay
- send notification
- multiple device actions
- run scene
- run another automation
- brightness
- fan speed
- thermostat/temperature where hardware supports it

---

## E. Future Scenes

Keep scenes separate from automations.

Examples:

```text
Good Morning
Movie Mode
Good Night
Away
Study Mode
Party
```

Scene example:

```text
Good Night
- all lights OFF
- fans OFF
- AC OFF
```

Automation can trigger a scene.

---

## F. Future Google Features

After basic integration:

- proactive Report State
- improved multi-room support
- richer device traits
- better sync/re-sync
- more device types
- scene support where supported
- integration health/status UI

Google's current guidance favors natural, speakable device names and room context.

Reference:

https://developers.home.google.com/cloud-to-cloud/support/faq

---

## G. Future Alexa Features

After basic integration:

- ChangeReport
- endpoint health
- richer device interfaces
- multi-room behavior
- additional device capabilities
- scenes
- richer state exposure

---

## H. Future Matter

Do not implement now.

Later evaluate:

```text
SwitchNest
   ├── Google Home Cloud-to-cloud
   ├── Alexa
   └── Matter
```

Matter introduces device/firmware and ecosystem considerations that deserve a separate design phase.

---

## I. Future Home Assistant

Possible integration:

```text
Home Assistant
      ↓
SwitchNest
      ↓
ESP32
```

Only consider after the core integration layer is stable.

---

## J. Future IFTTT-Like Platform

The goal is not to depend on IFTTT.

SwitchNest can eventually provide:

- webhooks
- API actions
- event subscriptions
- native automations
- custom triggers
- custom actions

The long-term product objective is that SwitchNest itself handles most common automation cases.

---

## K. Future AI

AI should be built on top of the same core services, not direct device logic.

Example:

> "Raat ko sab lights band kar do."

Potential future pipeline:

```text
AI
 ↓
intent extraction
 ↓
authorized SwitchNest action(s)
 ↓
DeviceService / AutomationEngine
 ↓
ESP32
```

AI must never bypass permission checks.

---

# Final Product Architecture Vision

```text
                         SWITCHNEST
                             |
             +---------------+----------------+
             |               |                |
            WEB          GOOGLE HOME        ALEXA
             |               |                |
             +---------------+----------------+
                             |
                     DEVICE / STATE SERVICE
                             |
                  +----------+----------+
                  |                     |
             AUTOMATION ENGINE       API / WEBHOOKS
                  |                     |
                  +----------+----------+
                             |
                           ESP32
```

Future adapters may include:

```text
Matter
Home Assistant
Mobile App
AI
```

### Core principle

**One core device/state/permission system, many integrations on top.**

---

# Final Agent Instructions

Before changing code:

1. Inspect the actual existing implementation.
2. Identify reusable services/routes/stores.
3. Report the smallest implementation plan.
4. Implement only the current basic integration scope.
5. Do not implement the future automation engine.
6. Do not modify ESP32 firmware unless truly required.
7. Prefer the existing Express backend as fulfillment.
8. Preserve Home isolation and roles.
9. Preserve audit logging.
10. Add tests.
11. Run typecheck, tests, lint if configured, and production build.
12. Report any platform-specific developer-console configuration that must be completed manually.

At the end report:

- files changed
- DB migrations
- routes/endpoints added
- OAuth flow
- Google status
- Alexa status
- tests run
- build result
- deployment/configuration requirements
- secrets/config variables required
- known limitations
- recommended next step

## Official References

### Google Home
- https://developers.home.google.com/cloud-to-cloud
- https://developers.home.google.com/cloud-to-cloud/project/authorization
- https://developers.home.google.com/cloud-to-cloud/intents/query
- https://developers.home.google.com/cloud-to-cloud/support/faq

### Amazon Alexa
- https://developer.amazon.com/docs/alexaplus/smarthome/steps-to-build-a-smart-home-skill.html
- https://developer.amazon.com/docs/alexaplus/account-linking/account-linking-for-sh-and-other.html
- https://developer.amazon.com/docs/alexaplus/account-linking/steps-to-implement-account-linking.html
- https://developer.amazon.com/en-US/docs/alexa/account-linking/standard-account-linking.html
- https://developer.amazon.com/docs/alexaplus/smarthome/state-reporting-for-smart-home-addons.html
- https://developer.amazon.com/docs/alexaplus/smarthome/test-the-addon-tutorial.html
