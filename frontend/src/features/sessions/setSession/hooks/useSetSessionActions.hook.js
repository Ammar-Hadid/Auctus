import { getErrorMessage } from "../../../../shared/utils/errorHelper";
import { useToast } from "../../../../shared/context/toastContext";
import { useConfirm } from "../../../../shared/context/confirmContext";
import { useRevalidator } from "react-router-dom";
import { useState } from "react";

import * as setSessionApi from "../api/setSession.api.js";

export const useSetSessionActions = ({ setSessions }) => {
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const revalidator = useRevalidator();

    const [pendingAction, setPendingAction] = useState(null);

    const runAction = async ({
        action,
        pendingKey,
        successMessage
    }) => {

        try {
            setPendingAction(pendingKey);

            const result = await action();

            await revalidator.revalidate();

            showToast(successMessage, "success");

            return result;
        }

        catch (error) {
            showToast(getErrorMessage(error));
            return null;
        }

        finally {
            setPendingAction(null);
        }
    }

    const startSetSession = async (id) => {
        const isSetInProgress = setSessions?.find(s => s.status === "in-progress");

        if (isSetInProgress) {
            showToast("Another set is currently in progress, please finish it before starting another one.");
            return null;
        }

        return await runAction({
            action: () => setSessionApi.startSetSession(id),
            pendingAction: `start:${id}`,
            successMessage: "Set started."
        });
    }

    return {
        startSetSession,
        isPending: pendingAction !== null,
    }
}