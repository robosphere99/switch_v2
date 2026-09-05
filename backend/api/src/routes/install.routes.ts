import { Router } from "express";
import * as installController from "../controllers/install.controller";

export const installRouter = Router();

installRouter.get("/status", installController.getInstallStatus);
installRouter.post("/connect", installController.connectStep);
installRouter.post("/schema", installController.schemaStep);
installRouter.post("/admin", installController.adminStep);
installRouter.post("/", installController.fullInstall);
