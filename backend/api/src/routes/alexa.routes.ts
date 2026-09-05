import { Router } from "express";
import { requireAlexaAuth } from "../middleware/alexaAuth";
import * as alexaController from "../controllers/alexa.controller";

export const alexaRouter = Router();

alexaRouter.post("/directive", requireAlexaAuth, alexaController.handleAlexaDirective);
