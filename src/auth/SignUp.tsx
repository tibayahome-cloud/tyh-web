import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { AuthLayout } from "../shared/components/AuthLayout";
import { returnPathFrom, withReturnPath } from "../shared/utils/returnPath";
import { SignUpForm } from "./SignUpForm";

export const SignUp = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // Where the person was heading when they were asked to create an account (for example straight into booking).
  const returnTo = useMemo(() => returnPathFrom(location), [location]);

  return (
    <AuthLayout
      split
      title={t("auth.signUpTitle")}
      subtitle="Book a doctor online or care at home."
      footer={
        <p className="text-sm text-slate-600">
          {t("auth.haveAccount")}{" "}
          <Link
            to={withReturnPath("/login", returnTo)}
            className="inline-flex min-h-11 items-center rounded px-1 font-semibold text-tiba-blue underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <SignUpForm
        // They go where they were heading, or to Home when they were not heading anywhere in particular.
        onSignedUp={() => navigate(returnTo ?? "/app/home", { replace: true })}
        // The account exists; only the automatic sign-in failed. The sign-in page finishes the job.
        onSignInNeeded={() => navigate(withReturnPath("/login", returnTo), { replace: true })}
      />
    </AuthLayout>
  );
};

export default SignUp;
