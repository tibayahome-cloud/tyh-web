import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../shared/components/Button";
import { Card } from "../shared/components/Card";
import { useAuth } from "../shared/hooks/useAuth";

export const SessionExpired = () => {
  const navigate = useNavigate();
  const { clearSessionExpired } = useAuth();

  useEffect(() => {
    return () => {
      clearSessionExpired();
    };
  }, [clearSessionExpired]);

  const handleLogin = () => {
    clearSessionExpired();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md text-center" title="Session expired">
        <p className="mb-6 text-sm text-slate-600">
          Your session has expired. Please sign in again to continue.
        </p>
        <Button onClick={handleLogin}>Go to login</Button>
      </Card>
    </div>
  );
};

