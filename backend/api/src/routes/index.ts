import { Router } from "express";
import { authRouter } from "./auth.routes";
import { homeRouter } from "./home.routes";
import { memberRouter } from "./member.routes";
import { deviceRouter } from "./device.routes";
import { deviceApiRouter } from "./deviceApi.routes";
import { apiKeyRouter } from "./apiKey.routes";
import { roomRouter } from "./room.routes";
import { scheduleRouter } from "./schedule.routes";
import { notificationRouter } from "./notification.routes";
import { assistantRouter } from "./assistant.routes";
import { adminRouter } from "./admin.routes";
import { shopRouter } from "./shop.routes";
import { claimRouter } from "./claim.routes";
import { warrantyRouter } from "./warranty.routes";
import { publicRouter } from "./public.routes";
import { supportRouter } from "./support.routes";
import { oauthRouter } from "./oauth.routes";
import { googleRouter } from "./google.routes";
import { alexaRouter } from "./alexa.routes";
import { webhookRouter } from "./webhook.routes";
import { firmwareRouter } from "./firmware.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/homes", homeRouter);
apiRouter.use("/homes", memberRouter); // member/invite routes live under /homes/:homeId/...
apiRouter.use("/homes", deviceRouter); // device routes live under /homes/:homeId/devices/...
apiRouter.use("/homes", roomRouter); // room routes live under /homes/:homeId/rooms/...
apiRouter.use("/homes", scheduleRouter); // schedule routes live under /homes/:homeId/schedules/...
apiRouter.use("/device", deviceApiRouter); // device-facing API (api_key auth) — ESP32 etc.
apiRouter.use("/api-keys", apiKeyRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/support", supportRouter);
apiRouter.use("/assistant", assistantRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/shop", shopRouter);
apiRouter.use("/claim", claimRouter);
apiRouter.use("/warranty", warrantyRouter);
apiRouter.use("/public", publicRouter);
apiRouter.use("/oauth", oauthRouter);
apiRouter.use("/integration/google", googleRouter);
apiRouter.use("/integration/alexa", alexaRouter);
apiRouter.use("/webhooks", webhookRouter);
apiRouter.use("/firmware", firmwareRouter);

/**
 * Mount table — OpenAPI docs (src/lib/openapi.ts) isi se paths enumerate
 * karta hai. Naya router mount karo to yahan ek line add karo — docs khud
 * update ho jati hai. (Express 5 mount layer pe path expose nahi karta,
 * isliye prefix yahan define karna padta hai.)
 */
export const apiMounts: Array<{ router: ReturnType<typeof Router>; prefix: string }> = [
  { router: authRouter, prefix: "/auth" },
  { router: homeRouter, prefix: "/homes" },
  { router: memberRouter, prefix: "/homes" },
  { router: deviceRouter, prefix: "/homes" },
  { router: roomRouter, prefix: "/homes" },
  { router: scheduleRouter, prefix: "/homes" },
  { router: deviceApiRouter, prefix: "/device" },
  { router: apiKeyRouter, prefix: "/api-keys" },
  { router: notificationRouter, prefix: "/notifications" },
  { router: supportRouter, prefix: "/support" },
  { router: assistantRouter, prefix: "/assistant" },
  { router: adminRouter, prefix: "/admin" },
  { router: shopRouter, prefix: "/shop" },
  { router: claimRouter, prefix: "/claim" },
  { router: warrantyRouter, prefix: "/warranty" },
  { router: publicRouter, prefix: "/public" },
  { router: oauthRouter, prefix: "/oauth" },
  { router: googleRouter, prefix: "/integration/google" },
  { router: alexaRouter, prefix: "/integration/alexa" },
  { router: webhookRouter, prefix: "/webhooks" },
  { router: firmwareRouter, prefix: "/firmware" },
];

