import express from "express";
import requireAuth from "../../../middleware/requireAuth.js";
import * as setSessionController from "./setSession.controller.js";

const router = express.Router();

router.post('/:setSessionId/start', requireAuth, setSessionController.startSetSession);
router.post('/:setSessionId/complete', requireAuth, setSessionController.completeSetSession);

export default router;