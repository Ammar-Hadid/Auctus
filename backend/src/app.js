import cors from "cors";

import express from 'express';

import cookieParser from "cookie-parser"

import authRouter from './features/auth/auth.routes.js';
import userRouter from './features/users/user.routes.js'
import dashboardRouter from "./features/dashboard/dashboard.routes.js";
import programRouter from './features/programs/program.routes.js';
import workoutRouter from './features/workouts/workout.routes.js';
import exerciseRouter from './features/exercises/exercise.routes.js';
import muscleGroupsRouter from './features/muscleGroups/muscleGroups.routes.js';

import workoutSessionsRouter from "./features/sessions/workoutSessions/workoutSession.routes.js";
import exerciseSessionsRouter from "./features/sessions/exerciseSessions/exerciseSession.routes.js";
import setSessionsRouter from "./features/sessions/setSessions/setSession.routes.js";

const app = express();

const allowedOrigins = (
    process.env.CLIENT_URL || 'https://auctus.ammarhadid.com'
)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(requestedOrigin, callback) {
        if (!requestedOrigin || allowedOrigins.includes(requestedOrigin)) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
}))

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);

app.use('/api/users', userRouter);

app.use('/api/dashboard', dashboardRouter)

app.use('/api/programs', programRouter);

app.use('/api/programs/:programId/workouts', workoutRouter);

app.use('/api/programs/:programId/workouts/:workoutId/exercises', exerciseRouter);

app.use('/api/muscle-groups', muscleGroupsRouter);

app.use('/api/workout-sessions', workoutSessionsRouter);

app.use('/api/exercise-sessions', exerciseSessionsRouter);

app.use('/api/set-sessions', setSessionsRouter);



export default app;
