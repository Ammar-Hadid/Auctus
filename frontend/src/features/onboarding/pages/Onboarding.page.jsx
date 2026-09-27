import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router-dom";

import Logo from "../../../shared/components/Logo.jsx";
import DefaultButton from "../../../shared/components/DefaultButton.jsx";
import WeightUnitOption from "../components/WeightUnitOption.component.jsx";

import { ShieldCheck } from "lucide-react";

import onboardingImage from "../images/onboarding.img.png";
import { completeOnboarding } from "../api/onboarding.api.js";
import { useToast } from "../../../shared/context/toastContext.jsx";
import { getErrorMessage } from "../../../shared/utils/errorHelper.js";

const GlowDivider = () => {
    return (
        <div className="flex items-center w-32">
            <div className="h-[4px] flex-1 bg-linear-to-l from-primary to-transparent" />

            <div className="size-md rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />

            <div className="h-[4px] flex-1 bg-linear-to-r from-primary to-transparent" />
        </div>
    )
}

const Onboarding = () => {
    const { user } = useLoaderData();
    const [weightUnit, setWeightUnit] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const { showToast } = useToast();


    if (!user) return null;

    const handleOnboardingSubmit = async (e) => {

        if (!weightUnit || isSubmitting) {
            return;
        }

        e.preventDefault();

        try {

            setIsSubmitting(true);

            await completeOnboarding({ weightUnit });

            navigate('/', { replace: true });

            showToast('Onboarding completed successfully.', 'success');

        }

        catch (error) {
            showToast(getErrorMessage(error));
        }

        finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex justify-between h-screen">
            <div className="flex flex-col items-start gap-2xl px-lg py-2xl self-center">
                <Logo variant="l" className="self-start" />

                <header className="flex flex-col gap-md items-start">
                    <h1 className="text-h2 text-text-primary font-semibold">Welcome to Auctus, <span className="text-primary">{user?.userName}</span></h1>
                    <p className="text-text-secondary text-body">Let&apos;s personalize your workout experience.</p>
                </header>

                <GlowDivider />

                <form className="flex w-full max-w-form flex-col gap-xl text-left" onSubmit={handleOnboardingSubmit}>
                    <fieldset className="flex flex-col gap-xl">
                        <div className="flex flex-col gap-sm text-left">
                            <legend className="w-full text-h4 font-semibold text-text-primary">
                                How do you want to measure weight?
                            </legend>
                            <p className="text-body-sm text-text-secondary">
                                We&apos;ll use this unit for weights throughout Auctus. You can change it later in Settings.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
                            <WeightUnitOption
                                unit="kg"
                                selectedUnit={weightUnit}
                                onChange={setWeightUnit}
                            />

                            <WeightUnitOption
                                unit="lb"
                                selectedUnit={weightUnit}
                                onChange={setWeightUnit}
                            />
                        </div>
                    </fieldset>


                    <div className="flex flex-col gap-lg items-start">
                        <DefaultButton
                            type="submit"
                            disabled={!weightUnit || isSubmitting}
                            className="w-full"
                        >
                            {!isSubmitting ? 'Continue to Auctus' : 'Saving preference...'}
                        </DefaultButton>

                        <div className="flex gap-sm items-cente text-text-secondary">
                            <ShieldCheck className="size-l" />
                            <span>You can change this anytime in settings.</span>
                        </div>

                    </div>
                </form>
            </div>

            <img
                src={onboardingImage}
                alt=""
                className="mask-[radial-gradient(ellipse_at_top_right,black_10%,transparent_90%)] max-w-[50dvw] self-end"
            />
        </div>
    )
}

export default Onboarding;
