import { Router } from "express";
import { emqxAuth, emqxAcl } from "../controllers/mqtt.controller";

export const mqttRouter = Router();

// EMQX Webhook endpoints for HTTP Authentication and ACL
mqttRouter.post("/auth", emqxAuth);
mqttRouter.post("/acl", emqxAcl);
