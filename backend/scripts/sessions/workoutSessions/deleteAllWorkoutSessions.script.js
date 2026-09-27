import "dotenv/config";
import mongoose from "mongoose";

import WorkoutSession from "../../../src/features/sessions/workoutSessions/WorkoutSession.model.js";
import ExerciseSession from "../../../src/features/sessions/exerciseSessions/ExerciseSession.model.js";
import SetSession from "../../../src/features/sessions/setSessions/SetSession.model.js"

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const askForConfirmation = async () => {
    const readline = createInterface({ input, output });

    try {

        const answer = await readline.question("Delete all workout, exercise, and set sessions? [y/N]");

        return answer.trim().toLocaleLowerCase() === 'y';
    }

    finally {
        readline.close();
    }

}

const deleteAllWorkoutSessions = async () => {

    const session = await mongoose.startSession();

    try {
        let workoutSessionResult;
        let exerciseSessionResult;
        let setSessionResult;

        await session.withTransaction(async () => {

            setSessionResult = await SetSession.deleteMany({}, { session });
            exerciseSessionResult = await ExerciseSession.deleteMany({}, { session });
            workoutSessionResult = await WorkoutSession.deleteMany({}, { session });
        });

        console.log(`Deleted ${workoutSessionResult.deletedCount} workout sessions & ${exerciseSessionResult.deletedCount} exercise sessions & ${setSessionResult.deletedCount} set sessions.`);
    }

    finally {
        session.endSession();
    }

}

const main = async () => {

    if (process.env.NODE_ENV === "production") {
        throw new Error("This script cannot run in production.");
    }

    const isConfirmed = await askForConfirmation();

    if (!isConfirmed) {
        console.log('Deletion cancelled.');
        return
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);

        await deleteAllWorkoutSessions();
    }

    finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
})