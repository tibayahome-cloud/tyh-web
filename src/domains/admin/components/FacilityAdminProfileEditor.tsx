import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { Button } from "../../../shared/components/Button";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { Input } from "../../../shared/components/Input";
import {
  updateFacilityAdminProfile,
  type FacilityAdminAccess,
  type FacilityAdminProfileInput,
  type FacilityAdminProfileResult
} from "../../../shared/libs/facilities";
import { getApiError, getApiFieldErrors } from "../../../shared/utils/errors";

type Field = "fullName" | "email" | "phone";
type Props = {
  facilityId: string;
  admin: FacilityAdminAccess;
  onSaved: (message: string) => void;
  onCancel: () => void;
};

const API_FIELD: Record<string, Field> = { full_name: "fullName", email: "email", phone: "phone" };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// What was changed, in the shape the API accepts. Nothing unchanged is sent.
export const buildAdminProfileChanges = (
  admin: Pick<FacilityAdminAccess, "fullName" | "email" | "phone">,
  form: { fullName: string; email: string; phone: string }
): FacilityAdminProfileInput => {
  const changes: FacilityAdminProfileInput = {};
  if (form.fullName.trim() !== admin.fullName) changes.fullName = form.fullName.trim();
  if (form.email.trim().toLowerCase() !== admin.email.toLowerCase()) changes.email = form.email.trim();
  if (form.phone.trim() !== (admin.phone ?? "")) changes.phone = form.phone.trim() || null;
  return changes;
};

export const describeAdminProfileResult = (result: FacilityAdminProfileResult, changes: FacilityAdminProfileInput): string => {
  const others = changes.fullName !== undefined || changes.phone !== undefined;
  if (result.emailChange?.status === "pending_verification") {
    return `${others ? "Name and phone changes were saved. " : ""}A verification link was sent to ${result.emailChange.email}. ${result.admin.email} stays the sign-in address until it is verified.`;
  }
  return changes.phone !== undefined ? "Details saved. The phone number needs to be verified again." : "Details saved.";
};

// Super-admin-only editing of a facility administrator's name, email and phone. The caller decides
// who sees it and the API enforces it. An email change is confirmed first and only takes effect
// once the new address is verified.
export const FacilityAdminProfileEditor = ({ facilityId, admin, onSaved, onCancel }: Props) => {
  const [form, setForm] = useState({ fullName: admin.fullName, email: admin.email, phone: admin.phone ?? "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const changes = buildAdminProfileChanges(admin, form);
  const emailChanging = changes.email !== undefined;

  const mutation = useMutation({
    mutationFn: () => updateFacilityAdminProfile(facilityId, admin.userId, changes),
    onSuccess: (result) => {
      setConfirming(false);
      onSaved(describeAdminProfileResult(result, changes));
    },
    onError: (error) => {
      setConfirming(false);
      const fields = getApiFieldErrors(error);
      const mapped: Partial<Record<Field, string>> = {};
      for (const [apiField, message] of Object.entries(fields)) {
        const field = API_FIELD[apiField];
        if (field) mapped[field] = message;
      }
      if (Object.keys(mapped).length > 0) {
        setErrors(mapped);
        setFormError(null);
      } else if (isAxiosError(error) && error.response?.status === 429) {
        setFormError("Too many changes. Wait a few minutes and try again.");
      } else if (isAxiosError(error) && error.response?.status === 404) {
        setFormError("This administrator is no longer assigned to the facility. Reload the page.");
      } else {
        setFormError(getApiError(error, "We could not save those details. Try again."));
      }
    }
  });

  const change = (field: Field, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const save = () => {
    const found: Partial<Record<Field, string>> = {};
    if (!form.fullName.trim()) found.fullName = "Enter the administrator's name.";
    if (!EMAIL_PATTERN.test(form.email.trim())) found.email = "Enter a valid email address.";
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    if (Object.keys(changes).length === 0) {
      onCancel();
      return;
    }
    if (emailChanging) {
      setConfirming(true);
      return;
    }
    mutation.mutate();
  };

  return (
    <form
      className="w-full space-y-3"
      noValidate
      aria-label={`Edit details for ${admin.email}`}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !mutation.isPending) onCancel();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Full name" name={`admin-name-${admin.userId}`} value={form.fullName} error={errors.fullName} onChange={(e) => change("fullName", e.target.value)} autoFocus />
        <Input label="Email" type="email" name={`admin-email-${admin.userId}`} value={form.email} error={errors.email} hint="A new address is used for sign-in only after it is verified." onChange={(e) => change("email", e.target.value)} />
        <Input label="Phone" name={`admin-phone-${admin.userId}`} value={form.phone} error={errors.phone} hint="Changing the phone clears its verification." placeholder="+254..." onChange={(e) => change("phone", e.target.value)} />
      </div>
      {formError && (
        <p className="text-sm text-danger-600" role="alert">
          {formError}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" size="sm" variant="secondary" disabled={mutation.isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={mutation.isPending && !confirming}>
          Save details
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Change this administrator's email?"
        description={`We will send a verification link to ${changes.email}. ${admin.email} stays the sign-in address until the new one is verified; after that the administrator is signed out everywhere and signs in with the new address.${admin.userStatus === "pending" ? " Setup is not finished, so a new setup invitation is sent to the verified address." : ""}`}
        confirmLabel="Send verification link"
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
        onClose={() => {
          if (!mutation.isPending) setConfirming(false);
        }}
      />
    </form>
  );
};
