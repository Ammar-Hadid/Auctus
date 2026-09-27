import Program from "../programs/Program.model.js";
import Workout from "../workouts/Workout.model.js";

import WorkoutSession from "../sessions/workoutSessions/WorkoutSession.model.js";
import { getCurrentWeekRange } from "../../utils/date/getCurrentWeekRange.js";

const getWorkoutsThisWeek = async (userId, programId) => {
    const { startOfWeek, endOfWeek } = getCurrentWeekRange();

    const [workouts, completedWorkoutIds] = await Promise.all([
        Workout.find({
            user: userId,
            program: programId,
        }).sort({ order: 1 }),

        WorkoutSession.distinct("workout",
            {
                user: userId,
                program: programId,
                status: "completed",
                completedAt: {
                    $gte: startOfWeek,
                    $lte: endOfWeek
                }
            })
    ]);

    const completedIds = new Set(
        completedWorkoutIds.map(id => id.toString())
    )


    const completedWorkoutsThisWeek = workouts.filter(workout => {
        return completedIds.has(workout._id.toString());
    })

    const notCompletedWorkoutsThisWeek = workouts.filter(workout => {
        return !completedIds.has(workout._id.toString())
    });

    return { completedWorkoutsThisWeek, notCompletedWorkoutsThisWeek };
}

const getActiveProgram = async (userId) => {

    const activeProgram = await Program.findOne({
        user: userId,
        isActive: true,
    });

    if (!activeProgram) return null;

    return activeProgram
}


export const buildDashboard = async (userId) => {

    const activeProgram = await getActiveProgram(userId);
    const workoutsThisWeek = await getWorkoutsThisWeek(userId, activeProgram?._id);

    return {
        activeProgram,
        workoutsThisWeek
    }
}
