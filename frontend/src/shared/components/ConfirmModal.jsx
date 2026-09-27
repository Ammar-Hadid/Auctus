const ConfirmModal = ({ options = {}, isOpen, onConfirm, onCancel }) => {
    const {
        mode = "danger",
        title = "Are you sure?",
        text = "This action cannot be undone",
        confirmText = "Proceed",
    } = options;

    const modalClassList = `fixed inset-0 z-100 flex items-center justify-center bg-bg-primary/80 p-md transition-opacity duration-100 ease-in-out`;
    const modalStateClassList = isOpen
        ? "opacity-100 pointer-events-auto"
        : "opacity-0 pointer-events-none";

    const contentWrapperClassList = `flex w-full max-w-modal flex-col gap-xl rounded-card border border-text-secondary/20 bg-bg-surface-elevated p-xl text-text-primary shadow-2xl md:p-2xl`;

    const buttonBaseClassList = `
        flex-1 cursor-pointer rounded-pill px-xl py-md
        text-body-sm whitespace-nowrap font-bold transition
        focus-visible:outline-none focus-visible:ring-4
    `;

    const modeClasses = {
        warning: "bg-warning text-bg-primary",
        danger: "bg-transparent text-danger border border-danger",
        default: "bg-primary text-text-primary",
    };

    const activeModeClass = modeClasses[mode] || modeClasses.default;

    const cancelButtonClassList = `
        ${buttonBaseClassList}
        border border-text-secondary/40 bg-transparent
        text-text-primary
        hover:bg-text-secondary/10
        focus-visible:ring-text-secondary/20
    `;

    const confirmButtonClassList = `
        ${buttonBaseClassList}
        ${activeModeClass}
        hover:brightness-110
        focus-visible:ring-primary/30
    `;

    return (
        <div className={`${modalClassList} ${modalStateClassList}`}>
            <div className={contentWrapperClassList}>
                <div className="flex flex-col gap-sm">
                    <h2 className="m-0 p-0 text-h5 tracking-wide">
                        {title}
                    </h2>

                    <p className="m-0 p-0 text-body text-text-secondary leading-xl">
                        {text}
                    </p>
                </div>

                <div className="flex w-full flex-col justify-between gap-md sm:flex-row">
                    <button
                        type="button"
                        onClick={onCancel}
                        className={cancelButtonClassList}
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        className={confirmButtonClassList}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;