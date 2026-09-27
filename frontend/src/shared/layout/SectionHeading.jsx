const SectionHeading = ({ heading }) => {
    if (!heading) return null;

    return (
        <h2 className="m-0 text-body md:text-body-sm font-semibold uppercase tracking-widest text-text-primary/95">
            {heading}
        </h2>
    );
}

export default SectionHeading;
