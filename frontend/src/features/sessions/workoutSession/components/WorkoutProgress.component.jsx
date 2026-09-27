import Card from "../../../../shared/layout/Card";
import SectionHeading from "../../../../shared/layout/SectionHeading";

import { Dumbbell, BookmarkCheck, Clock } from "lucide-react";

import IconBadge from "../../../../shared/components/IconBadge.component";
import DefaultButton from "../../../../shared/components/DefaultButton";

import { useEstimatedTimeLeft } from "../hooks/useEstimatedTimeLeft.hook";
import CurrentTotalCount from "../../shared/currentTotalCount.component";


const LoadingBar = ({ width }) => {
    if (!Number.isFinite(width)) return null;

    return (
        <div className="relative bg-bg-surface w-full h-md rounded-xl overflow-hidden border border-success/25">
            <div
                className={`
                     absolute content-[''] top-0 left-0 bottom-0 h-md
                     bg-success transition-[width] duration-200 ease-in-out`}
                style={{ width: `${width}%` }}
            />
        </div>
    )
}

const ProgressItem = ({ label, value, icon: Icon = '' }) => {
    if (!label || !value) return null;

    return (
        <div className="flex flex-col gap-md">
            <span className="text-text-secondary text-body uppercase">{label}</span>
            <span className="text-body-lg flex items-center gap-md">
                <Icon className="text-text-secondary" />
                {value}
            </span>
        </div>
    )
}

const WorkoutProgress = ({
    workoutSession,
    progress,
    progressPercentage,
    completeWorkout,
    isPending,
}) => {
    const { totalExercisesCount, completedExercisesCount } = progress;
    const estimatedTimeLeft = useEstimatedTimeLeft(workoutSession)

    if (
        !Number.isFinite(totalExercisesCount) ||
        !Number.isFinite(completedExercisesCount) ||
        !Number.isFinite(progressPercentage) ||
        !Number.isFinite(estimatedTimeLeft)
    ) return null;

    return (
        <Card className="flex flex-col lg:flex-row lg:items-center justify-between">

            <div className="flex flex-col lg:flex-row gap-2xl lg:gap-3xl lg:divide-x lg:divide-text-secondary lg:items-center">
                <div className="flex flex-col items-start gap-lg lg:flex-row lg:items-center pr-3xl">
                    <IconBadge
                        icon={Dumbbell}
                        className="p-lg"
                        iconClassName="size-3xl text-text-primary"
                    />

                    <div className="flex flex-col gap-sm lg:gap-0">
                        <SectionHeading heading="Workout Progress" />

                        <CurrentTotalCount current={completedExercisesCount} total={totalExercisesCount} />

                        <div className="flex flex-col gap-md lg:gap-sm">
                            <div className="flex gap-xl">
                                <span className="text-pr">Exercises completed</span>
                                <span>{progressPercentage}%</span>
                            </div>

                            <LoadingBar width={progressPercentage} />
                        </div>
                    </div>
                </div>

                <div>
                    <ProgressItem
                        label="est. time left"
                        value={`${estimatedTimeLeft} min`}
                        icon={Clock} />
                </div>
            </div>

            <DefaultButton
                className="flex items-center gap-sm"
                onClick={completeWorkout}
                disabled={isPending || workoutSession.status !== "in-progress"}
            >
                <BookmarkCheck />
                {isPending ? "Updating workout..." : "Finish workout"}
            </DefaultButton>
        </Card >
    )
}

export default WorkoutProgress
