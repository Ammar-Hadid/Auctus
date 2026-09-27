import { useState } from "react";

import StepIndicator from "../../shared/StepIndicator.component";
import { ChevronDown } from "lucide-react";
import StatusBadge from "../../shared/StatusBadge.component";
import DefaultButton from "../../../../shared/components/DefaultButton";

import Card from "../../../../shared/layout/Card";
import formatMuscleGroup from "../../../muscleGroups/utils/formatMuscleGroup.js";

const ExerciseDataItem = ({ label, value }) => {
    if (!label || !value) return null;

    return (
        <div className="flex flex-col gap-sm px-lg py-sm">
            <span className="text-text-secondary text-body-sm">{label}</span>
            <span className="text-text-primary text-body">{value}</span>
        </div>
    )
}

const ExerciseItem = ({ exercise, startExercise, isPending, pendingAction }) => {
    const [isOpen, setIsOpen] = useState(false);

    const {
        _id,
        orderSnapshot,
        nameSnapshot,
        status,
        muscleGroupSnapshot,
        setsSnapshot,
        minRepsSnapshot,
        maxRepsSnapshot,
        restTimeSnapshot
    } = exercise;

    if (
        !_id ||
        !orderSnapshot ||
        !nameSnapshot ||
        !status ||
        !muscleGroupSnapshot ||
        !setsSnapshot ||
        !minRepsSnapshot ||
        !maxRepsSnapshot ||
        !restTimeSnapshot) return null;

    const chevronStateStyles = isOpen ? 'rotate-180' : 'rotate-0';
    const dataWrapperStateStyles = isOpen ? 'max-h-1000 translate-y-0 opacity-100 p-lg pointer-events-auto' : 'max-h-0 translate-y-2 opacity-0 pointer-events-none';

    const getButtonString = () => {
        if (!pendingAction) return 'Start Exercise';

        const [action, id] = pendingAction.split(':');

        if (action === 'start' && id === _id) {
            return 'Starting Exercise...';
        }

        return 'Start Exercise'

    }

    return (
        <div className={`border text-body flex flex-col gap-sm rounded-xl ${status === 'in-progress' ? 'border-primary/75' : 'border-text-primary/25'}`}>
            <button onClick={() => setIsOpen(prev => !prev)} className="flex flex-col md:flex-row justify-between md:items-center pt-md md:pt-lg px-md md:px-lg pb-sm gap-lg">
                <div className="flex items-center gap-md text-start">
                    <StepIndicator step={orderSnapshot} />
                    <p>{nameSnapshot}</p>
                </div>

                <div className="flex items-center gap-sm md:gap-md">
                    <StatusBadge status={status} />


                    <ChevronDown className={`${chevronStateStyles} cursor-pointer transition-transform duration-200 ease-in-out`} />

                </div>
            </button>

            <div className={`flex flex-col gap-lg justify-between transition-max-h duration-200 ease-in-out ${dataWrapperStateStyles}`}>
                <div className="flex gap-sm md:gap-0 flex-wrap xl:divide-x divide-text-primary/25">

                    <ExerciseDataItem label="Sets" value={`${setsSnapshot} x ${minRepsSnapshot}-${maxRepsSnapshot}`} />

                    <ExerciseDataItem label="Primary Muscle" value={formatMuscleGroup(muscleGroupSnapshot)} />

                    <ExerciseDataItem label="Rest Time" value={`${restTimeSnapshot}s`} />
                </div>

                <DefaultButton
                    disabled={status === 'in-progress' || status === 'completed' || isPending}
                    onClick={() => startExercise(_id)}
                >
                    {getButtonString()}
                </DefaultButton>
            </div>

        </div>
    )
}

const ExercisesQueue = ({ exercises, startExercise, isPending, pendingAction }) => {
    if (!exercises?.length) return null;

    return (
        <Card heading="up next" className="flex-1 min-h-0 lg:h-full ">

            <div
                className="min-h-0 flex-1 lg:overflow-y-auto lg:overflow-x-hidden
                lg:overscroll-contain flex flex-col gap-lg pr-xs"
            >
                {exercises?.map(exercise => {
                    return <ExerciseItem key={exercise._id} exercise={exercise} startExercise={startExercise} isPending={isPending} pendingAction={pendingAction} />
                })}
            </div>
        </Card>
    )
}

export default ExercisesQueue
