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
apiRouter.use("/assistant", assistantRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/shop", shopRouter);
apiRouter.use("/claim", claimRouter);
apiRouter.use("/warranty", warrantyRouter);
apiRouter.use("/public", publicRouter);
