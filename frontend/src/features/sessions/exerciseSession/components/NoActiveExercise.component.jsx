import { Dumbbell } from "lucide-react";

import Card from "../../../../shared/layout/Card.jsx";
import IconBadge from "../../../../shared/components/IconBadge.component.jsx";

const NoActiveExercise = () => {
    return (
        <Card className="flex-1 justify-top sm:min-h-[60dvh]!">
            <div className="relative mt-md flex min-h-72 overflow-hidden text-center">
                <div
                    className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl"
                    aria-hidden="true"
                />

                <div className="relative m-auto flex flex-col items-center gap-lg">

                    <IconBadge icon={Dumbbell} className="p-md" iconClassName="size-2xl" strokeWidth={1.5} />

                    <div>
                        <h2 className="m-0 text-body-lg font-semibold text-text-primary">
                            No exercise in progress
                        </h2>

                        <p className="m-0 mt-sm text-body text-text-secondary">
                            Start an exercise to track your sets, progress, and rest time here.
                        </p>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default NoActiveExercise;
