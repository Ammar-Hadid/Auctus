import SectionHeading from "./SectionHeading";

export const Card = ({ children, heading = '', className = '' }) => {
    return (
        <div className={`flex flex-col gap-lg min-w-0 rounded-card border border-text-secondary/15 bg-gradient-surface shadow-2xl p-lg md:p-2xl ${className}`}>
            {heading && <SectionHeading heading={heading} />}
            {children}
        </div>
    )
}

export default Card;