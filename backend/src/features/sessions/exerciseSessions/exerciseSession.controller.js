import mongoose from "mongoose";
import ExerciseSession from "./ExerciseSession.model.js";
import { cancelInProgressSetForExerciseSession } from "../setSessions/setSession.service.js";
import { skipUnfinishedSetsForExerciseSession } from "../setSessions/setSession.service.js";

export const startExerciseSession = async (req, res) => {
    const { exerciseSessionId } = req.params;

    if (!mongoose.isValidObjectId(exerciseSessionId)) {
        return res.status(400).json({ error: 'Invalid exercise session id.' })
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const previousExerciseSession = await ExerciseSession.findOneAndUpdate(
            {
                user: req.userId,
                status: "in-progress",
                _id: { $ne: exerciseSessionId },
            },
            {
                status: "skipped",
                skippedAt: new Date(),
            },
            {
                runValidators: true,
                session,
            }
        );

        const exerciseSession = await ExerciseSession.findOneAndUpdate(
            {
                user: req.userId,
                _id: exerciseSessionId,
                status: {
                    $in: ["not-started", "skipped"],
                },
            },
            [
                {
                    $set: {
                        status: "in-progress",
                        startedAt: {
                            $ifNull: ["$startedAt", "$$NOW"],
                        },
                        skippedAt: null,
                    },
                },
            ],
            {
                new: true,
                runValidators: true,
                updatePipeline: true,
                session,
            }
        );

        if (previousExerciseSession) {
            await cancelInProgressSetForExerciseSession({
                userId: req.userId,
                exerciseSessionId: previousExerciseSession._id,
                session,
            });
        }

        if (!exerciseSession) {
            await session.abortTransaction();

            return res.status(404).json({
                error: "Exercise session not found.",
            });
        }

        await session.commitTransaction();

        return res.status(200).json({ exerciseSession });
    }

    catch (error) {
        await session.abortTransaction();
        console.error(error);

        return res.status(500).json({
            error: "Server error.",
        });
    }

    finally {
        await session.endSession();
    }
}

export const completeExerciseSession = async (req, res) => {
    const { exerciseSessionId } = req.params;

    if (!mongoose.isValidObjectId(exerciseSessionId)) {
        return res.status(400).json({ error: 'Invalid exercise session id.' });
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const exerciseSession = await ExerciseSession.findOneAndUpdate(
            {
                user: req.userId,
                _id: exerciseSessionId,
                status: 'in-progress'
            },

            {
                status: 'completed',
                completedAt: new Date(),
                skippedAt: null,
            },

            {
                runValidators: true,
                new: true,
                session,
            }
        );

        if (!exerciseSession) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Exercise session not found' });
        }

        await skipUnfinishedSetsForExerciseSession({
            userId: req.userId,
            exerciseSessionId: exerciseSession._id,
            skippedAt: exerciseSession.completedAt,
            session,
        });

        await session.commitTransaction();

        return res.status(200).json({ exerciseSession });
    }

    catch (error) {
        await session.abortTransaction();
        console.error(error);
        return res.status(500).json({ error: 'Server error.' })
    }

    finally {
        await session.endSession();
    }
}

export const skipExerciseSession = async (req, res) => {
    const { exerciseSessionId } = req.params;

    if (!mongoose.isValidObjectId(exerciseSessionId)) {
        return res.status(400).json('Invalid exercise session id.');
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const exerciseSession = await ExerciseSession.findOneAndUpdate(
            {
                user: req.userId,
                _id: exerciseSessionId,
                status: {
                    $in: ['not-started', 'in-progress'],
                },
            },

            {
                status: 'skipped',
                skippedAt: new Date(),
            },

            {
                new: true,
                runValidators: true,
                session,
            },
        );

        if (exerciseSession) {
            await cancelInProgressSetForExerciseSession({
                userId: req.userId,
                exerciseSessionId: exerciseSession._id,
                session,
            });
        }

        if (!exerciseSession) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Exercise session not found.' });
        }

        await session.commitTransaction();
        return res.status(200).json({ exerciseSession });
    }

    catch (error) {
        await session.abortTransaction();
        console.error(error);
        return res.status(500).json({ error: 'Server error.' });
    }

    finally {
        await session.endSession();
    }
}
