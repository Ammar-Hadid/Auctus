import { CURRENT_ONBOARDING_VERSION } from "./onboarding.constants.js";

const serializeUser = (user) => {
    const completedVersion = user.onboarding?.completedVersion ?? 0;

    return {
        id: user._id,
        userName: user.userName,
        email: user.email,
        preferences: {
            weightUnit: user.preferences?.weightUnit ?? null,
        },
        onboarding: {
            completedVersion,
            completedAt: user.onboarding?.completedAt ?? null,
            requiredVersion: CURRENT_ONBOARDING_VERSION,
            needsOnboarding: completedVersion < CURRENT_ONBOARDING_VERSION,
        },
    };
};

export default serializeUser;
