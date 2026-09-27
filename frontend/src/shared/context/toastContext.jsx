import { useState, createContext, useContext, useRef } from "react";

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState(null);

    const timeoutRef = useRef(null);

    const showToast = (message, variant = "danger") => {
        setToast({ message, variant });

        clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => setToast(null), 3000)
    }

    const variantsClassList = {
        success: 'border-success bg-success-200 text-success',
        warning: 'border-warning bg-warning-200 text-warning',
        danger: 'border-danger bg-danger-200 text-danger',
    }

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {toast &&
                (
                    <div className="fixed left-1/2 top-lg z-50 w-[min(90vw,32rem)] -translate-x-1/2">
                        <p className={`${variantsClassList[toast.variant] ?? variantsClassList.danger} rounded-card border p-md text-center text-body-sm font-medium shadow-2xl backdrop-blur-md`}>{toast.message}</p>
                    </div>
                )
            }
        </ToastContext.Provider>
    )
};

export const useToast = () => {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error('useToast must be used inside ToastProvider')
    }

    return context
}



