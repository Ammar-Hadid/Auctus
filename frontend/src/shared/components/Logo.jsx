const Logo = ({ variant = 's', showText = true, className = "" }) => {

    const variants = {
        s: "size-xl",
        m: "size-2xl",
        l: "size-3xl",
        xl: "size-4xl",
        "2xl": "size-5xl",
    };

    const textVariants = {
        s: "text-body-sm",
        m: "text-body",
        l: "text-body-lg",
        xl: "text-h4",
        "2xl": "text-h3",
    };
    return (
        <div className={`${className} flex items-center gap-lg`}>
            <img
                src="/auctus-logo.svg"
                alt=""
                className={`${variants[variant]} shrink-0`}
            />

            {showText && <span className={`${textVariants[variant]} font-logo uppercase tracking-widest text-text-primary font-light`}>Auctus</span>}
        </div>
    )
}

export default Logo;