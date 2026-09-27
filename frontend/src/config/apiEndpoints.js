import { getApiUrl } from "./api";

export const API_ENDPOINTS = Object.freeze({
    auth: getApiUrl("/auth"),
    users: getApiUrl("/users"),
    dashboard: getApiUrl("/dashboard"),
    muscleGroups: getApiUrl("/muscle-groups"),
    programs: getApiUrl("/programs"),
    workoutSessions: getApiUrl("/workout-sessions"),
    exerciseSessions: getApiUrl("/exercise-sessions"),
    setSessions: getApiUrl("/set-sessions"),
});
