import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Camera, Trash2 } from "lucide-react";

import { Card } from "../../../shared/components/Card";
import { Button } from "../../../shared/components/Button";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useToast } from "../../../shared/components/ToastProvider";
import api from "../../../shared/libs/api";

type ProfileFormState = {
  fullName: string;
  email: string;
  phone: string;
};

const buildInitialForm = (user?: { fullName: string; email: string | null; phone: string | null }): ProfileFormState => ({
  fullName: user?.fullName ?? "",
  email: user?.email ?? "",
  phone: user?.phone ?? ""
});

const ClientProfilePage = () => {
  const { user, bootstrapMe } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formState, setFormState] = useState<ProfileFormState>(() => buildInitialForm(user ?? undefined));
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setFormState(buildInitialForm(user ?? undefined));
    setAvatarPreview(user?.avatarUrl ?? null);
  }, [user]);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl]
  );

  const profileMutation = useMutation({
    mutationFn: async (payload: ProfileFormState) => {
      if (!user?.id) {
        throw new Error("Missing user id");
      }
      await api.patch(`/users/${user.id}`, {
        full_name: payload.fullName,
        email: payload.email,
        phone: payload.phone
      });
    },
    onSuccess: async () => {
      await bootstrapMe();
      toast.showToast({
        title: "Profile updated",
        description: "Your contact information was saved."
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to update profile",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    }
  });

  const avatarUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) {
        throw new Error("Missing user id");
      }
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/users/${user.id}/avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    },
    onSuccess: async () => {
      await bootstrapMe();
      toast.showToast({
        title: "Photo updated",
        description: "Your avatar was refreshed."
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Select a different file and try again.",
        variant: "error"
      });
      setAvatarPreview(user?.avatarUrl ?? null);
    }
  });

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error("Missing user id");
      }
      await api.delete(`/users/${user.id}/avatar`);
    },
    onSuccess: async () => {
      await bootstrapMe();
      toast.showToast({
        title: "Photo removed",
        description: "We deleted your profile picture."
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to remove photo",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    }
  });

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setAvatarPreview(url);
    avatarUploadMutation.mutate(file);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    profileMutation.mutate(formState);
  };

  const hasAvatar = useMemo(() => Boolean(user?.avatarUrl || avatarPreview), [user?.avatarUrl, avatarPreview]);

  return (
    <div className="space-y-6">
      <Card title="Your profile" description="Update your picture and contact details.">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={user?.fullName}
                  className="h-32 w-32 rounded-full object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-100 text-3xl font-semibold text-slate-500 shadow-inner">
                  {user?.fullName?.charAt(0).toUpperCase() ?? "U"}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-black/5"
                title="Change photo"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleAvatarChange}
            />
            {hasAvatar && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAvatarMutation.mutate()}
                loading={removeAvatarMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex-1 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="full-name">
                Full name
              </label>
              <input
                id="full-name"
                type="text"
                value={formState.fullName}
                onChange={(event) => setFormState((prev) => ({ ...prev, fullName: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="Your preferred name"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formState.email ?? ""}
                  onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  placeholder="name@email.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formState.phone ?? ""}
                  onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  placeholder="+254 700 000000"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button type="submit" loading={profileMutation.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default ClientProfilePage;
