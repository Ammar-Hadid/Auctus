import { API_ENDPOINTS } from "../../../../config/apiEndpoints";
import { throwApiError } from "../../../../shared/utils/errorHelper";

const setSessionApiUrl = (setSessionId, action) =>
    `${API_ENDPOINTS.setSessions}/${encodeURIComponent(setSessionId)}/${action}`;

export const transitionSetSession = async (url, body = null) => {

    const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },

        ...(body !== null && {
            body: JSON.stringify(body),
        }),
    });

    const data = await res.json();

    if (!res.ok) {
        throwApiError(data);
    }

    return data;
}

export const startSetSession = async (id) =>
    await transitionSetSession(setSessionApiUrl(id, "start"));

export const completeSetSession = async (id, body) =>
    await transitionSetSession(setSessionApiUrl(id, "complete"), body);