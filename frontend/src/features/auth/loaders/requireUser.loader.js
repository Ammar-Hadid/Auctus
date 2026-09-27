import { redirect } from "react-router-dom";
import { getCurrentUser } from "../api/auth.api";

export const requireUser = async () => {
    const user = await getCurrentUser();

    if (!user) {
        throw redirect('/login');
    }

    if (user?.onboarding?.needsOnboarding) {
        throw redirect('/onboarding');
    } 

    return { user };
}