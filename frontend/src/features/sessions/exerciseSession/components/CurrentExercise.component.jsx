import Card from "../../../../shared/layout/Card.jsx";
import MuscleDiagram from "../../../muscleGroups/components/MuscleDiagram/MuscleDiagram.jsx";
import StepIndicator from "../../shared/StepIndicator.component.jsx";
import DefaultButton from "../../../../shared/components/DefaultButton.jsx";
import StatusBadge from "../../shared/StatusBadge.component.jsx";
import formatMuscleGroup from "../../../muscleGroups/utils/formatMuscleGroup.js";

import NoActiveExercise from "./NoActiveExercise.component.jsx";

const CurrentExercise = ({
    featuredExercise,
    completeExercise,
    skipExercise,
    isPending,
}) => {
    if (!featuredExercise) return null;

    const {
        _id,
        nameSnapshot,
        muscleGroupSnapshot,
        orderSnapshot,
        restTimeSnapshot,
        setsSnapshot,
        minRepsSnapshot,
        maxRepsSnapshot,
    } = featuredExercise;


    return (
        <Card heading="Current exercise" className="flex-1 bg-none border-0 shadow-none p-0 md:p-0 lg:p-0">
            <div className="flex flex-col gap-lg">
                <div className="flex flex-wrap items-center justify-between gap-md">
                    <div className="flex items-center gap-md">
                        <StepIndicator variant="featured" step={orderSnapshot} />

                        <div>
                            <p className="m-0 text-body-lg font-semibold text-text-primary">
                                {nameSnapshot}
                            </p>
                            <p className="m-0 mt-xs text-body-sm text-text-secondary">
                                {setsSnapshot} sets × {minRepsSnapshot}–{maxRepsSnapshot} reps
                            </p>
                        </div>
                    </div>

                    <StatusBadge status='in-progress' />
                </div>

                <div className="grid items-stretch gap-lg md:grid-cols-[minmax(0,1.35fr)_minmax(11rem,0.65fr)]">
                    <MuscleDiagram
                        primaryMuscle={muscleGroupSnapshot}
                        className="h-56 min-h-56 rounded-xl border border-primary/10 md:h-64"
                    />

                    <dl className="m-0 flex flex-col justify-center gap-lg border-text-secondary/15 md:border-l md:pl-lg">
                        <div>
                            <dt className="text-body-sm text-text-secondary">Primary muscle</dt>
                            <dd className="m-0 mt-xs font-semibold text-primary">
                                {formatMuscleGroup(muscleGroupSnapshot)}
                            </dd>
                        </div>

                        <div>
                            <dt className="text-body-sm text-text-secondary">Rest time</dt>
                            <dd className="m-0 mt-xs text-text-primary">
                                {restTimeSnapshot} seconds
                            </dd>
                        </div>
                    </dl>
                </div>

                <div className="flex flex-col lg:flex-row gap-md">
                    <DefaultButton
                        onClick={() => completeExercise(_id)}
                        disabled={isPending}
                    >
                        Complete exercise
                    </DefaultButton>

                    <DefaultButton
                        onClick={() => skipExercise(_id)}
                        variant="secondary"
                        disabled={isPending}
                    >
                        Skip exercise
                    </DefaultButton>
                </div>
            </div>
        </Card>
    );
};

export default CurrentExercise;
