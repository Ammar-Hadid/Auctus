import express from "express";
import requireAuth from "../../../middleware/requireAuth.js";
import { startSetSession } from "./setSession.controller.js";

const router = express.Router();

router.post('/:setSessionId/start', requireAuth, startSetSession);

export default router;