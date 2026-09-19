import ExerciseSession from "./ExerciseSession.model.js"
import SetSession from "../setSessions/SetSession.model.js"

export const createExerciseSessionsFromExercises = async ({ exercises, session, userId, workoutSession }) => {
    const exerciseSessions = exercises.map(exercise => {
        return {
            user: userId,
            workoutSession,
            exercise: exercise._id,
            nameSnapshot: exercise.name,
            muscleGroupSnapshot: exercise.muscleGroup,
            orderSnapshot: exercise.order,
            restTimeSnapshot: exercise.restTime,
            setsSnapshot: exercise.sets,
            minRepsSnapshot: exercise.minReps,
            maxRepsSnapshot: exercise.maxReps,
        }
    })

    const createdExerciseSessions = await ExerciseSession.insertMany(exerciseSessions, { session });

    return createdExerciseSessions
}

export const finalizeExerciseSessionsForWorkout = async ({
    userId,
    workoutSessionId,
    session
}) => {

    const completedExerciseSessionIds = await SetSession.distinct(
        "exerciseSession",

        {
            user: userId,
            workoutSession: workoutSessionId,
            status: "completed"
        },

        {
            session
        }
    );

    if (completedExerciseSessionIds.length) {
        await ExerciseSession.updateMany(
            {
                user: userId,
                _id: {
                    $in: completedExerciseSessionIds,
                },
            },

            [
                {
                    $set: {
                        status: "completed",

                        completedAt: {
                            $ifNull: ["$completedAt", "$$NOW"],
                        },
                    },
                },
            ],

            {
                session,
                updatePipeline: true,
            }
        )
    };

    await ExerciseSession.updateMany(
        {
            user: userId,
            workoutSession: workoutSessionId,
            _id: {
                $nin: completedExerciseSessionIds,
            },
        },

        [
            {
                $set: {
                    status: "skipped",

                    skippedAt: {
                        $ifNull: ["$skippedAt", "$$NOW"]
                    }
                }
            }
        ],

        {
            session,
            updatePipeline: true,
        }
    )
}
