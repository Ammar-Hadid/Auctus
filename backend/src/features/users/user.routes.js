import express from "express";

import requireAuth from "../../middleware/requireAuth.js";
import validateCompleteOnboarding from "./user.middleware.js";
import { completeOnboarding } from "./user.controller.js";

const router = express.Router();

router.patch('/me/onboarding',
    requireAuth,
    validateCompleteOnboarding,
    completeOnboarding
)

export default router;