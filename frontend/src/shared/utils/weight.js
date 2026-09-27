const LB_PER_KG = 2.20462262185;
const VALID_WEIGHT_UNITS = ["kg", "lb"];

export const convertWeightFromKg = (weightKg, weightUnit) => {
    if (
        !Number.isFinite(weightKg) ||
        !VALID_WEIGHT_UNITS.includes(weightUnit)
    ) {
        return null;
    }

    return weightUnit === "lb"
        ? weightKg * LB_PER_KG
        : weightKg;
};

export const formatWeight = (weightKg, weightUnit) => {
    const convertedWeight = convertWeightFromKg(
        weightKg,
        weightUnit,
    );

    if (convertedWeight === null) {
        return "—";
    }

    const roundedWeight =
        Math.round(convertedWeight * 100) / 100;

    return `${roundedWeight} ${weightUnit}`;
};

export const convertWeightToKg = (weightInLb) => {
    if (!weightInLb) throw new Error("Weight is missing.");

    return weightInLb / LB_PER_KG;
}