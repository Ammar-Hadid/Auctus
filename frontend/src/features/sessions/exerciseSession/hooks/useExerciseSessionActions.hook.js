import { useState } from "react";
import { useRevalidator } from "react-router-dom";

import {
    startExerciseSession,
    completeExerciseSession,
    skipExerciseSession
} from "../api/exerciseSession.api";

import { useConfirm } from "../../../../shared/context/confirmContext";
import { useToast } from "../../../../shared/context/toastContext";
import { getErrorMessage } from "../../../../shared/utils/errorHelper";

export const useExerciseSessionActions = ({ exerciseSessions }) => {
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const revalidate = useRevalidator();

    const [pendingAction, setPendingAction] = useState(null);

    const runAction = async ({
        action,
        pendingKey,
        successMessage
    }) => {
        try {
            setPendingAction(pendingKey);

            const result = await action();

            await revalidate.revalidate();

            showToast(successMessage, 'success');

            return result;
        }

        catch (error) {
            showToast(getErrorMessage(error));
            return null;
        }

        finally {
            setPendingAction(null);
        }
    };

    const startExercise = async (id) => {

        const isSwitchingExercise = exerciseSessions?.find(({ status }) =>
            status === 'in-progress'
        )

        if (isSwitchingExercise) {
            const isConfirmed = await confirm({
                mode: 'warning',
                title: 'Start another exercise?',
                text: 'You already have an exercise in progress. Starting a new one will mark it as skipped. Completed sets will stay completed, while your active set will be marked as not started. You can resume the exercise later.',
                confirmText: 'Start New Exercise',
            });

            if (!isConfirmed) return null;
        }

        return await runAction({
            action: () => startExerciseSession(id),
            pendingKey: `start:${id}`,
            successMessage: 'Exercise started',
        });
    };

    const completeExercise = async (id) => {
        return await runAction({
            action: () => completeExerciseSession(id),
            pendingKey: `complete:${id}`,
            successMessage: 'Exercise completed',
        });
    };

    const skipExercise = async (id) => {
        return await runAction({
            action: () => skipExerciseSession(id),
            pendingKey: `skip:${id}`,
            successMessage: 'Exercise skipped',
        });
    };

    return {
        startExercise,
        completeExercise,
        skipExercise,
        pendingAction,
        isPending: pendingAction !== null,
    }
}
