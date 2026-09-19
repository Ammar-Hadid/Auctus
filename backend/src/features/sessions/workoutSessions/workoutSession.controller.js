import mongoose from "mongoose";

import Workout from "../../workouts/Workout.model.js";
import Exercise from "../../exercises/Exercise.model.js";

import WorkoutSession from "./WorkoutSession.model.js";
import ExerciseSession from "../exerciseSessions/ExerciseSession.model.js";

import { createExerciseSessionsFromExercises } from "../exerciseSessions/exerciseSession.service.js";
import { createSetSessionsFromExerciseSessions } from "../setSessions/setSession.service.js";
import SetSession from "../setSessions/SetSession.model.js";

import { skipUnfinishedSetsForWorkoutSession } from "../setSessions/setSession.service.js";
import { finalizeExerciseSessionsForWorkout } from "../exerciseSessions/exerciseSession.service.js";

export const createWorkoutSession = async (req, res) => {
    const { workoutId } = req.body;

    if (!mongoose.isValidObjectId(workoutId)) {
        return res.status(400).json({ error: 'Invalid workout id.' });
    }

    const session = await mongoose.startSession();

    try {
        const activeWorkoutSession = await WorkoutSession.findOne({
            user: req.userId,
            status: { $in: ['in-progress', 'paused'] },
        });

        if (activeWorkoutSession) {
            return res.status(409).json({
                error: 'You already have an unfinished workout session. Resume and complete it before starting a new workout.',
                activeWorkoutSession
            })
        }

        const workout = await Workout.findOne({
            user: req.userId,
            _id: workoutId
        });

        if (!workout) {
            return res.status(404).json({ error: 'Workout not found.' });
        }

        const exercises = await Exercise.find({
            user: req.userId,
            workout: workoutId
        });

        if (exercises.length < 1) {
            return res.status(404).json({ error: 'Workout contains no exercises.' })
        }

        session.startTransaction();

        const [workoutSession] = await WorkoutSession.create([{
            user: req.userId,
            program: workout.program,
            workout: workout._id,
            workoutNameSnapshot: workout.name,
            workoutOrderSnapshot: workout.order,
            workoutDurationSnapshot: workout.duration,
        }], { session });

        const exerciseSessions = await createExerciseSessionsFromExercises({
            exercises,
            session,
            userId: req.userId,
            workoutSession: workoutSession._id,
        });

        const setSessions = await createSetSessionsFromExerciseSessions({
            userId: req.userId,
            exerciseSessions,
            workoutSessionId: workoutSession._id,
            session
        });

        await session.commitTransaction();
        return res.status(201).json({ workoutSession, exerciseSessions, setSessions });
    }

    catch (error) {
        await session.abortTransaction();
        console.error(error);
        return res.status(500).json({ error: 'Server error.' });
    }

    finally {
        session.endSession();
    }
}

export const getActiveWorkoutSession = async (req, res) => {
    try {
        const workoutSession = await WorkoutSession.findOne({
            user: req.userId,
            status: { $in: ['in-progress', 'paused'] },
        });

        if (!workoutSession) {
            return res.status(200).json({
                workoutSession: null,
                exerciseSessions: [],
                setSessions: [],
            });
        }

        const exerciseSessions = await ExerciseSession.find({
            user: req.userId,
            workoutSession: workoutSession._id,
        }).sort({ orderSnapshot: 1 });

        const setSessions = await SetSession.find({
            user: req.userId,
            workoutSession: workoutSession._id,
        });

        return res.status(200).json({
            workoutSession,
            exerciseSessions,
            setSessions,
        });
    }

    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error.' })
    }
}

export const getWorkoutSessionById = async (req, res) => {
    const { workoutSessionId } = req.params;

    if (!mongoose.isValidObjectId(workoutSessionId)) {
        return res.status(400).json({ error: 'Invalid workout session id.' })
    }

    try {
        const workoutSession = await WorkoutSession.findOne({
            user: req.userId,
            _id: workoutSessionId,
        });

        if (!workoutSession) {
            return res.status(404).json({ error: 'Workout session not found.' });
        };

        const exerciseSessions = await ExerciseSession.find({
            user: req.userId,
            workoutSession: workoutSession._id,
        }).sort({ orderSnapshot: 1 });

        const setSessions = await SetSession.find({
            user: req.userId,
            workoutSession: workoutSession._id,
        })

        return res.status(200).json({
            workoutSession,
            exerciseSessions,
            setSessions
        });
    }

    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error.' })
    }
}

export const completeWorkoutSession = async (req, res) => {
    const { workoutSessionId } = req.params;

    if (!mongoose.isValidObjectId(workoutSessionId)) {
        return res.status(400).json({ error: 'Invalid workout session id.' });
    }

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        const workoutSession = await WorkoutSession.findOneAndUpdate(
            {
                user: req.userId,
                _id: workoutSessionId,
                status: 'in-progress',
            },

            [
                {
                    $set: {
                        status: 'completed',
                        completedAt: "$$NOW",
                        accumulatedMs: {
                            $add: [
                                "$accumulatedMs",
                                {
                                    $subtract: [
                                        "$$NOW",
                                        "$activeStartedAt",
                                    ],
                                },
                            ],
                        },
                        activeStartedAt: null,
                    },
                },
            ],

            {
                new: true,
                updatePipeline: true,
                session,
            },
        );

        if (!workoutSession) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Active workout session not found.' });
        }

        await finalizeExerciseSessionsForWorkout(
            {
                userId: req.userId,
                workoutSessionId: workoutSession._id,
                session,
            }
        )

        await skipUnfinishedSetsForWorkoutSession(
            {
                userId: req.userId,
                workoutSessionId: workoutSession._id,
                skippedAt: workoutSession.completedAt,
                session,
            }
        );

        await session.commitTransaction();

        return res.status(200).json({ workoutSession });
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

export const pauseWorkoutSession = async (req, res) => {
    const { workoutSessionId } = req.params;

    if (!mongoose.isValidObjectId(workoutSessionId)) {
        return res.status(400).json({ error: 'Invalid workout session id.' });
    }

    try {
        const workoutSession = await WorkoutSession.findOneAndUpdate(
            {
                user: req.userId,
                _id: workoutSessionId,
                status: 'in-progress',
            },

            [
                {
                    $set: {
                        status: 'paused',
                        pausedAt: "$$NOW",
                        accumulatedMs: {
                            $add: [
                                "$accumulatedMs",
                                {
                                    $subtract: [
                                        "$$NOW",
                                        "$activeStartedAt",
                                    ],
                                },
                            ],
                        },
                        activeStartedAt: null,
                    },
                },
            ],

            {
                new: true,
                updatePipeline: true,
            },
        );

        if (!workoutSession) {
            return res.status(404).json({ error: 'Active workout session not found.' });
        }

        return res.status(200).json({ workoutSession });
    }

    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error.' });
    }
}

export const resumeWorkoutSession = async (req, res) => {
    const { workoutSessionId } = req.params;

    if (!mongoose.isValidObjectId(workoutSessionId)) {
        return res.status(400).json({ error: 'Invalid workout session id.' });
    }

    try {
        const workoutSession = await WorkoutSession.findOneAndUpdate(
            {
                user: req.userId,
                _id: workoutSessionId,
                status: 'paused',
            },

            {
                status: 'in-progress',
                activeStartedAt: new Date(),
                pausedAt: null,
            },

            {
                runValidators: true,
                new: true,
            }
        );

        if (!workoutSession) {
            return res.status(404).json({ error: 'Workout session not found.' });
        }

        return res.status(200).json({ workoutSession });
    }

    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error.' });
    }
}

export const discardWorkoutSession = async (req, res) => {
    const { workoutSessionId } = req.params;

    if (!mongoose.isValidObjectId(workoutSessionId)) {
        return res.status(400).json({ error: 'Invalid workout session id.' });
    }

    const session = await mongoose.startSession();

    try {

        const workoutSession = await WorkoutSession.findOne(
            {
                user: req.userId,
                _id: workoutSessionId,
            },

            { id: 1 },

            {
                session,
            }
        );

        if (!workoutSession) {
            return res.status(404).json({ error: 'Workout session not found.' });
        }

        session.startTransaction();

        const exerciseSessions = await ExerciseSession.deleteMany(
            {
                user: req.userId,
                workoutSession: workoutSession._id,
            },

            { session },
        );

        await SetSession.deleteMany(
            {
                user: req.userId,
                workoutSession: workoutSessionId,
            },

            {
                session,
            },
        )

        await WorkoutSession.deleteOne(
            {
                user: req.userId,
                _id: workoutSession._id,
            },

            { session },
        );

        await session.commitTransaction();
        return res.status(200).json({ workoutSession, exerciseSessions });
    }

    catch (error) {
        await session.abortTransaction();
        console.error(error);
        return res.status(500).json({ error: 'Server error.' });
    }

    finally {
        session.endSession();
    }
}
