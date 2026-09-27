const units = {
    kg: {
        symbol: "kg",
        name: "Kilograms",
        system: "Metric",
        badgeClass: "bg-primary/15 text-primary",
    },
    lb: {
        symbol: "lb",
        name: "Pounds",
        system: "Imperial",
        badgeClass: "bg-[#7B60EE]/15 text-[#7B60EE]",
    },
};

const WeightUnitOption = ({ unit, selectedUnit, onChange }) => {
    const option = units[unit];

    return (
        <label className="block cursor-pointer">
            <input
                type="radio"
                name="weightUnit"
                value={unit}
                checked={selectedUnit === unit}
                onChange={() => onChange(unit)}
                className="peer sr-only"
            />

            <div
                className="flex h-full flex-col gap-xl rounded-card border border-text-primary/25 p-xl transition duration-200 peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-primary/25"
            >
                <div
                    className={`flex size-3xl items-center justify-center rounded-full font-semibold ${option.badgeClass}`}
                >
                    {option.symbol}
                </div>

                <div className="flex flex-col gap-xs">
                    <span className="font-semibold text-text-primary">
                        {option.name}
                    </span>

                    <span className="text-body-sm text-text-secondary">
                        {option.system} ({option.symbol})
                    </span>
                </div>
            </div>
        </label>
    );
};

export default WeightUnitOption;
