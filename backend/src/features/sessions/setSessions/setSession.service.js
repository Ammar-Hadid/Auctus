import {
    InternalServerError,
    NotFoundError,
    ValidationError,
} from "../../../errors/index.js";

import SetSession from "./SetSession.model.js";
import mongoose from "mongoose";
import WorkoutSession from "../workoutSessions/WorkoutSession.model.js";

export const createSetSessionsFromExerciseSessions = async ({ userId, exerciseSessions, workoutSessionId, session }) => {

    const setSessions = exerciseSessions.flatMap(exerciseSession => {
        return Array.from(
            { length: exerciseSession.setsSnapshot },

            (_, index) => (
                {
                    user: userId,
                    workoutSession: workoutSessionId,
                    exerciseSession,
                    order: index + 1,
                }
            )
        )
    });

    const createdSetSessions = await SetSession.insertMany(setSessions, { session });

    return createdSetSessions;
}

export const cancelInProgressSetForExerciseSession = async ({
    userId,
    exerciseSessionId,
    session,
}) => {
    return SetSession.findOneAndUpdate(
        {
            user: userId,
            exerciseSession: exerciseSessionId,
            status: "in-progress",
        },
        {
            status: "not-started",
            startedAt: null,
        },
        {
            new: true,
            runValidators: true,
            session,
        },
    );
};

const skipUnfinishedSets = async ({
    filter,
    skippedAt,
    session
}) => {

    return await SetSession.updateMany(
        {
            ...filter,
            status: {
                $ne: "completed",
            },
        },

        {
            status: "skipped",
            skippedAt,
        },

        {
            session,
            runValidators: true,
            new: true,
        }
    );
}

export const skipUnfinishedSetsForWorkoutSession = async ({
    userId,
    workoutSessionId,
    skippedAt,
    session,
}) => {

    return await skipUnfinishedSets({
        filter: {
            user: userId,
            workoutSession: workoutSessionId,
        },
        skippedAt,
        session
    })
}

export const skipUnfinishedSetsForExerciseSession = async ({
    userId,
    exerciseSessionId,
    skippedAt,
    session,
}) => {

    return await skipUnfinishedSets({
        filter: {
            user: userId,
            exerciseSession: exerciseSessionId,
        },
        skippedAt,
        session
    })
}

export const startSetSession = async ({
    userId,
    setSessionId,
}) => {

    const session = await mongoose.startSession();

    try {
        return await session.withTransaction(async () => {
            const now = new Date();


            const currentSet = await SetSession.findOneAndUpdate(
                {
                    user: userId,
                    _id: setSessionId,
                    status: "not-started",
                },

                {
                    status: "in-progress",
                    startedAt: now,
                },

                {
                    new: true,
                    runValidators: true,
                    session,
                }
            )

            if (!currentSet) {
                throw new NotFoundError("Set not found.")
            }

            const workoutSession = await WorkoutSession.findOne(
                {
                    user: userId,
                    _id: currentSet.workoutSession,
                }
            ).session(session);

            if (!workoutSession) {
                throw new InternalServerError("Set session references a missing workout session.");
            }

            if (workoutSession.status !== "in-progress") {
                throw new ValidationError("Workout session is not in progress.");
            }

            const previousSetSession = await SetSession.findOne(
                {
                    user: userId,
                    workoutSession: currentSet.workoutSession,
                    status: "completed",
                    completedAt: { $ne: null },
                    restAfterMs: null,
                },

                {},

                {
                    session,
                }
            ).sort({ completedAt: -1 });

            if (previousSetSession) {

                const restAfterMs = currentSet.startedAt - previousSetSession.completedAt;

                previousSetSession.restAfterMs = restAfterMs;

                await previousSetSession.save({ session });
            }

            return currentSet;
        });

    }

    finally {
        await session.endSession();
    }
}

export const completeSetSession = async ({
    userId,
    setSessionId,
    setData
}) => {
    const session = await mongoose.startSession();
    const { weightKg, reps } = setData;

    try {
        return await session.withTransaction(async () => {
            const setSession = await SetSession.findOneAndUpdate(
                {
                    user: userId,
                    _id: setSessionId,
                    status: "in-progress",
                },

                {
                    status: "completed",
                    completedAt: new Date(),
                    weightKg,
                    reps
                },

                {
                    new: true,
                    runValidators: true,
                    session,
                }
            );

            if (!setSession) {
                throw new NotFoundError("Set session not found.");
            }

            const workoutSession = await WorkoutSession.findOne({
                user: userId,
                _id: setSession.workoutSession,
            }).session(session);

            if (!workoutSession) {
                throw new InternalServerError("Set session references a missing workout session.")
            }

            if (workoutSession.status !== "in-progress") {
                throw new ValidationError("Workout session is not in progress.")
            }

            return setSession;
        })
    }

    finally {
        await session.endSession();
    }
}