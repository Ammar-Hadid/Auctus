const VALID_WEIGHT_UNITS = ['kg', 'lb'];

const validateCompleteOnboarding = (req, res, next) => {
    const { weightUnit } = req.body ?? {};

    if (typeof weightUnit !== 'string') {
        return res.status(400).json({ error: 'Weight unit is required and must be a string.' });
    }

    if (!VALID_WEIGHT_UNITS.includes(weightUnit)) {
        return res.status(400).json({ error: 'Weight unit must be kg or lb.' });
    }

    next();
}

export default validateCompleteOnboarding;