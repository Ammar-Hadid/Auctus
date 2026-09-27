import { API_ENDPOINTS } from "../../../config/apiEndpoints.js"
import { getErrorMessage, throwApiError } from "../../../shared/utils/errorHelper.js";

const ONBOARDING_URL = `${API_ENDPOINTS.users}/me/onboarding`

export const completeOnboarding = async ({ weightUnit }) => {

    const res = await fetch(ONBOARDING_URL, {
        method: 'PATCH',
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ weightUnit }),
        credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
        throwApiError(getErrorMessage(data));
    };

    return data;
}