import { useLoaderData, useRouteLoaderData } from "react-router-dom";

import { getFeaturedExerciseSession } from "../selectors/workoutsession.selectors.js";

import ActiveExercisePanel from "../../exerciseSession/components/ActiveExercisePanel.component.jsx";

import ExercisesQueue from "../components/ExercisesQueue.component.jsx";

import { useSetSessionActions } from "../../setSession/hooks/useSetSessionActions.hook.js";
import { useExerciseSessionActions } from "../../exerciseSession/hooks/useExerciseSessionActions.hook.js";
import { useWorkoutSessionActions } from "../hooks/useWorkoutSessionActions.hook.js";

import WorkoutProgress from "../components/WorkoutProgress.component.jsx";
import { getWorkoutProgress } from "../selectors/workoutProgress.selector.js";

import WorkoutSessionHeader from "../components/WorkoutSessionHeader.component.jsx";

const WorkoutSession = () => {
    const { workoutSession, exerciseSessions, setSessions } = useLoaderData();
    const { user } = useRouteLoaderData('root');

    const {
        startExercise,
        completeExercise,
        skipExercise,
        pendingAction: pendingExerciseAction,
        isPending: isExerciseActionPending,
    } = useExerciseSessionActions({ exerciseSessions });

    const {
        pauseWorkout,
        resumeWorkout,
        completeWorkout,
        discardWorkout,
        pendingAction: pendingWorkoutAction,
        isPending: isWorkoutActionPending,
    } = useWorkoutSessionActions(workoutSession?._id, exerciseSessions);

    const {
        startSetSession,
        completeSetSession,
        pendingAction: pendingSetAction,
        isPending: isSetActionPending,
    } = useSetSessionActions({ setSessions });

    if (!workoutSession ||
        !exerciseSessions ||
        !user?.preferences?.weightUnit
    ) return null;

    const featuredExerciseSession = getFeaturedExerciseSession(exerciseSessions);
    const areExerciseActionsDisabled =
        isExerciseActionPending ||
        isWorkoutActionPending ||
        workoutSession.status !== "in-progress";

    const featuredSetSessions = setSessions
        ?.filter(session => {
            return session?.exerciseSession === featuredExerciseSession?._id
        })
        ?.sort((a, b) => a.order - b.order);

    const { progress, progressPercentage } = getWorkoutProgress({ exerciseSessions });

    return (
        <div className="flex flex-col gap-xl pb-3xl">

            <WorkoutSessionHeader
                workoutSession={workoutSession}
                pauseWorkout={pauseWorkout}
                resumeWorkout={resumeWorkout}
                discardWorkout={discardWorkout}
                pendingAction={pendingWorkoutAction}
                isPending={isWorkoutActionPending}
            />

            <div className="grid min-w-0 grid-cols-1 gap-lg lg:grid-cols-2">
                <ActiveExercisePanel
                    featuredExercise={featuredExerciseSession}
                    completeExercise={completeExercise}
                    skipExercise={skipExercise}
                    areExerciseActionsDisabled={areExerciseActionsDisabled}
                    setSessions={featuredSetSessions}
                    weightUnit={user.preferences.weightUnit}

                    startSetSession={startSetSession}
                    completeSetSession={completeSetSession}
                    pendingAction={pendingSetAction}
                    isPending={isSetActionPending}

                />

                <div className="min-h-0 min-w-0 lg:relative">
                    <div className="lg:absolute lg:inset-0">
                        <ExercisesQueue
                            exercises={exerciseSessions}
                            startExercise={startExercise}
                            isPending={areExerciseActionsDisabled}
                            pendingAction={pendingExerciseAction}
                        />
                    </div>
                </div>
            </div>

            <WorkoutProgress
                workoutSession={workoutSession}
                progress={progress}
                progressPercentage={progressPercentage}
                completeWorkout={completeWorkout}
                isPending={isWorkoutActionPending}
            />
        </div>
    );
}

export default WorkoutSession;
