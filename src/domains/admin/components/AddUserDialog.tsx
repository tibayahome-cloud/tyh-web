import { useEffect, useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { isAxiosError } from "axios";

import { Button } from "../../../shared/components/Button";
import { FormField } from "../../../shared/components/FormField";
import { Input } from "../../../shared/components/Input";
import { Loading } from "../../../shared/components/Loading";
import { api } from "../../../shared/libs/api";

type RoleOption = {
  id: string;
  key: string;
  name: string;
};

type Envelope<T> = {
  data: T;
};

const addUserSchema = z
  .object({
    fullName: z.string().trim().min(3, "Name must be at least 3 characters"),
    email: z
      .string()
      .trim()
      .email("Enter a valid email")
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .trim()
      .min(6, "Phone must be at least 6 characters")
      .optional()
      .or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters"),
    status: z.enum(["pending", "active", "suspended"]).default("pending"),
    roles: z.array(z.string()).default([]),
  })
  .superRefine((value, ctx) => {
    const hasEmail = typeof value.email === "string" && value.email.trim().length > 0;
    const hasPhone = typeof value.phone === "string" && value.phone.trim().length > 0;
    if (!hasEmail && !hasPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least an email or phone number",
        path: ["email"],
      });
    }
  });

type AddUserFormValues = z.infer<typeof addUserSchema>;

const defaultValues: AddUserFormValues = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  status: "pending",
  roles: [],
};

type AddUserDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const extractErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const data = error.response?.data as { data?: { message?: string }; meta?: { message?: string } } | undefined;
    return (
      data?.meta?.message ??
      (typeof data?.data === "object" && data?.data && "message" in data.data
        ? String((data.data as { message?: string }).message)
        : error.message)
    );
  }
  return "Unable to create user";
};

export const AddUserDialog = ({ open, onClose, onSuccess }: AddUserDialogProps) => {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues
  });

  const { data: roleOptions, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["admin", "rbac", "roles"],
    queryFn: async () => {
      const response = await api.get<Envelope<RoleOption[]>>("/rbac/roles");
      return response.data.data;
    },
    staleTime: 5 * 60_000
  });

  const createUserMutation = useMutation({
    mutationFn: async (payload: AddUserFormValues) => {
      const body = {
        full_name: payload.fullName.trim(),
        email: payload.email?.trim() || undefined,
        phone: payload.phone?.trim() || undefined,
        password: payload.password,
        status: payload.status,
        roles: payload.roles
      };
      await api.post("/users", body);
    },
    onSuccess: () => {
      onSuccess();
      reset(defaultValues);
      setFormError(null);
    },
    onError: (error) => {
      setFormError(extractErrorMessage(error));
    }
  });

  const submit = handleSubmit((values) => {
    setFormError(null);
    createUserMutation.mutate(values);
  });

  const handleClose = () => {
    if (createUserMutation.isPending || isSubmitting) {
      return;
    }
    onClose();
  };

  useEffect(() => {
    if (!open) {
      reset(defaultValues);
      setFormError(null);
    }
  }, [open, reset]);

  const roles = useMemo(() => roleOptions ?? [], [roleOptions]);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Invite a new user</DialogTitle>
      <DialogContent dividers>
        <form id="add-user-form" className="space-y-4" onSubmit={submit}>
          <FormField
            control={control}
            name="fullName"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label="Full name"
                placeholder="Jane Doe"
                error={fieldState.error?.message}
                autoFocus
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="email"
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  label="Email"
                  placeholder="jane@example.com"
                  type="email"
                  error={fieldState.error?.message}
                />
              )}
            />
            <FormField
              control={control}
              name="phone"
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  label="Phone"
                  placeholder="+254700000000"
                  error={fieldState.error?.message}
                />
              )}
            />
          </div>
          <FormField
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label="Temporary password"
                type="password"
                placeholder="Generate a secure password"
                error={fieldState.error?.message}
              />
            )}
          />
          <FormField
            control={control}
            name="status"
            render={({ field, fieldState }) => (
              <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
                <span>Status</span>
                <select
                  {...field}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
                {fieldState.error && <span className="text-xs text-red-500">{fieldState.error.message}</span>}
              </label>
            )}
          />
          <FormField
            control={control}
            name="roles"
            render={({ field, fieldState }) => (
              <div className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
                <span>Roles</span>
                {isLoadingRoles ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <Loading label="Loading roles" />
                  </div>
                ) : (
                  <select
                    multiple
                    value={field.value}
                    onChange={(event) => {
                      const options = Array.from(event.target.selectedOptions).map((option) => option.value);
                      field.onChange(options);
                    }}
                    className="h-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.key}>
                        {role.name} ({role.key})
                      </option>
                    ))}
                  </select>
                )}
                <span className="text-xs font-normal text-slate-500">
                  Hold Ctrl/Cmd to select multiple roles. Leave empty to assign defaults.
                </span>
                {fieldState.error && <span className="text-xs text-red-500">{fieldState.error.message}</span>}
              </div>
            )}
          />
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button variant="secondary" onClick={handleClose} disabled={createUserMutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" form="add-user-form" loading={createUserMutation.isPending}>
          Create user
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddUserDialog;
