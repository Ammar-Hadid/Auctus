import { redirect } from "react-router-dom";
import { getCurrentUser } from "../../auth/api/auth.api.js";

export const requireOnboarding = async () => {
    const user = await getCurrentUser();

    if (!user) {
        throw redirect('/login');
    }

    if (!user.onboarding.needsOnboarding) {
        throw redirect('/');
    }

    return { user }
}
