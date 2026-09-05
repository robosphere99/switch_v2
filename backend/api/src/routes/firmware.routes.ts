import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as firmwareController from "../controllers/firmware.controller";

export const firmwareRouter = Router();

firmwareRouter.get("/current", requireAuth, firmwareController.getCurrentFirmware);
