import User from "./User.model.js";
import { CURRENT_ONBOARDING_VERSION } from "./onboarding.constants.js";
import serializeUser from "./user.serializer.js";

export const completeOnboarding = async (req, res) => {
    const { weightUnit } = req.body;

    try {
        const user = await User.findOneAndUpdate(
            {
                _id: req.userId,
            },

            {
                "preferences.weightUnit": weightUnit,
                "onboarding.completedVersion": CURRENT_ONBOARDING_VERSION,
                "onboarding.completedAt": new Date(),
            },

            {
                new: true,
                runValidators: true,
            }
        )

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        return res.status(200).json({
            user: serializeUser(user)
        });
    }

    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error.' });
    }
}