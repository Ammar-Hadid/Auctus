const getDecimalAmount = (number) => {
    return String(number)?.split('.')?.[1]?.length ?? 0
}

const NumberStepperInput = ({ id, label, value, onChange, step, min = 0 }) => {

    const parsedValue = Number(value);
    const currentValue = Number.isFinite(parsedValue) ? parsedValue : min;

    const changeBy = (direction) => {

        const decimalAmount = getDecimalAmount(step);

        const nextValue = Number(
            (currentValue + direction * step).toFixed(decimalAmount));

        onChange(Math.max(min, nextValue));
    }

    return (
        <div className="flex min-w-0 flex-col gap-sm">
            <label htmlFor={id} className="text-text-secondary">{label}</label>

            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] overflow-hidden rounded-md border border-text-primary/30">

                <button
                    type="button"
                    onClick={() => changeBy(-1)}
                    aria-label={`Decrease ${label}`}
                    className="flex cursor-pointer items-center justify-center border-r border-text-primary/30 bg-transparent text-text-secondary hover:text-text-primary"
                >-
                </button>

                <input
                    id={id}
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}

                    className="no-number-spinner min-w-0 w-full bg-transparent p-sm text-text-secondary focus:outline-0"
                />

                <button
                    type="button"
                    onClick={() => changeBy(1)}
                    aria-label={`Increase ${label}`}
                    className="flex cursor-pointer items-center justify-center border-l border-text-primary/30 bg-transparent text-text-secondary hover:text-text-primary"
                >+
                </button>
            </div >
        </div >
    )
}

export default NumberStepperInput;
