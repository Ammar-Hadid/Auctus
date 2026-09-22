import { useState } from "react";
import Card from "../../../../shared/layout/Card.jsx";
import { formatWeight, convertWeightToKg } from "../../../../shared/utils/weight.js";

import { Check, X, CircleCheckBig, Play } from "lucide-react";

import DefaultButton from "../../../../shared/components/DefaultButton.jsx";

import NumberStepperInput from "./NumberStepperInput.jsx";

import StatusBadge from "../../shared/StatusBadge.component.jsx";

const StatusIndicator = ({ status = "not-started" }) => {

    const statusStylesVatiants = {
        "not-started": 'border-3 border-primary/45',
        "in-progress": 'border border-primary/50 relative',
        "completed": 'border border-success',
        "skipped": 'border border-danger',
    };

    return (
        <div className={`${statusStylesVatiants[status]} size-xl rounded-full p-sm flex items-center justify-center`}>
            {status === 'completed' && <Check className="text-success" />}
            {status === 'skipped' && <X className="text-danger" />}
            {status === 'in-progress' && <div className="size-lg bg-primary rounded-full shrink-0" />}
        </div>
    )
};

const InProgressSetControls = ({ setId, prevSetReps = 0, prevSetWeight = 0, weightUnit, completeSetSession, pendingAction, isPending }) => {
    const initialFormData = {
        reps: prevSetReps,
        weight: prevSetWeight,
    }
    const [formData, setFormData] = useState(initialFormData);

    const isConfirmButtonDisabled = !formData.weight;

    const updateField = (name, value) => {

        setFormData(prev => (
            {
                ...prev,
                [name]: value,
            }
        ));
    };

    const handleCompleteSetSession = (e) => {
        e.preventDefault();

        const body = {
            reps: formData.reps,
            weightKg: weightUnit === "lb" ? convertWeightToKg(formData.weight) : formData.weight,
        }

        completeSetSession(setId, body);
    }

    return (
        <div>
            <form className="grid grid-cols-1 gap-x-md gap-y-lg sm:grid-cols-2" onSubmit={handleCompleteSetSession}>
                <NumberStepperInput
                    id="reps"
                    label="Reps"
                    value={formData.reps}
                    onChange={(value) => updateField("reps", value)}

                    step={1}
                    min={1}
                />

                <NumberStepperInput
                    id="weight"
                    label={`Weight (${weightUnit})`}
                    value={formData.weight}
                    onChange={(value) => updateField("weight", value)}

                    step={0.5}
                />

                <DefaultButton
                    type="submit"
                    disabled={isConfirmButtonDisabled}
                    className="w-full gap-sm flex-1 sm:col-start-1 sm:col-end-3"
                >
                    <CircleCheckBig />
                    Complete set
                </DefaultButton>
            </form>
        </div>
    )
}

const UpNextBadge = () => {
    return (
        <div className="uppercase font-display bg-primary/200 text-primary border border-primary rounded-xl py-sm px-md font-semibold text-body-sm">up next</div>
    )
}

const NextSesseionControls = ({ setId, startSetSession, pendingAction, isPending }) => {

    return (
        <div className="flex-1 p-md">
            <DefaultButton
                className="w-full flex items-center justify-center gap-md"

                disabled={isPending}
                onClick={() => startSetSession(setId)}
            >
                <Play />
                Start set
            </DefaultButton>
        </div>
    )
}

const SetBox = ({ set, previousSet, weightUnit, isnextSetSession, startSetSession, completeSetSession, pendingAction, isPending }) => {

    const visualStatus = isnextSetSession
        ? "in-progress"
        : set.status;

    const boxStatusVariants = {
        "not-started": "border border-text-primary/25",
        "in-progress": "border border-primary p-md",
        completed: "border border-success",
        skipped: "border border-danger",
    };

    const boxClasses =
        boxStatusVariants[visualStatus] ??
        boxStatusVariants["not-started"];

    const repUnit = (repsAmount) => repsAmount > 1 ? "reps" : "rep";

    return (
        <div className={`${boxClasses} flex flex-col gap-md rounded-lg text-body`}>
            <div className="p-md rounded-lg flex items-center justify-between">

                <div className="flex items-center gap-lg">
                    <span className="text-body-lg">Set {set?.order}</span>

                    {set?.status === 'completed'
                        ? (
                            <div className="flex items-center gap-md">
                                <span className="text-text-secondary">{set.reps} {repUnit(set.reps)}</span>
                                <div className="size-1.75 bg-text-secondary rounded-full" />
                                <span className="text-text-secondary">{formatWeight(set.weightKg, weightUnit)}</span>
                            </div>
                        ) : null}

                    {set?.status === 'in-progress' && (
                        <StatusBadge status="in-progress" />
                    )}
                </div>

                <div className="flex items-center gap-md md:gap-lg">
                    {isnextSetSession && <UpNextBadge />}
                    <StatusIndicator status={set?.status} />
                </div>
            </div>

            {set.status === 'in-progress' && (
                <InProgressSetControls
                    setId={set._id}
                    weightUnit={weightUnit}

                    prevSetReps={previousSet?.reps ?? 0}
                    prevSetWeight={previousSet?.weightKg ?? 0}

                    completeSetSession={completeSetSession}
                    pendingAction={pendingAction}
                    isPending={isPending}
                />
            )}

            {isnextSetSession && (
                <NextSesseionControls
                    setId={set._id}
                    startSetSession={startSetSession}
                    pendingAction={pendingAction}
                    isPending={isPending}
                />
            )}
        </div>
    )
}

const SetsProgress = ({ sets, weightUnit, startSetSession, pendingAction, isPending, completeSetSession }) => {
    if (!sets || !weightUnit) return null;

    const isnextSetSession = (set) => {
        const isSetInProgress = sets.find(s => s.status === "in-progress");

        if (isSetInProgress) return false;

        const nextSessionId = sets.find(s => s.status === "not-started")?._id;

        if (nextSessionId === set._id) return true;
    }

    return (
        <div>
            <Card heading="Sets progress" className="flex-1 bg-none border-0 shadow-none p-0 md:p-0 lg:p-0">
                <div className="flex flex-col gap-md text-body-sm">
                    {sets.map((set, index) => {
                        const previousSet = index > 0 ? sets[index - 1] : null;

                        return <SetBox
                            key={set._id}
                            set={set}
                            previousSet={previousSet}
                            weightUnit={weightUnit}
                            isnextSetSession={isnextSetSession(set)}
                            startSetSession={startSetSession}
                            completeSetSession={completeSetSession}
                            pendingAction={pendingAction}
                            isPending={isPending}
                        />
                    })}
                </div>
            </Card>
        </div>
    )
};

export default SetsProgress;