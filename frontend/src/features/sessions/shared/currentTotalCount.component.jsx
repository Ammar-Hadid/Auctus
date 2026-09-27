const CurrentTotalCount = ({ current, total }) => {
    return (
        <span className="text-h2">
            <span>{current}</span>
            <span className="text-text-secondary">/{total}</span>
        </span>
    )
}

export default CurrentTotalCount;