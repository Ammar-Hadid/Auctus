import * as setSessionService from "./setSession.service.js";

export const startSetSession = async (req, res) => {
    const { setSessionId } = req.params;

    try {
        const setSession = await setSessionService.startSetSession({
            userId: req.userId,
            setSessionId,
        });

        return res.status(200).json({ setSession: setSession });
    }

    catch (error) {
        console.error(error);
        return res.status(error.statusCode).json({ error: 'Server error.' });
    }
}