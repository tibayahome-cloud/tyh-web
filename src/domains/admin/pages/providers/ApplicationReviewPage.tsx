import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { Loading } from "../../../../shared/components/Loading";
import { Modal } from "../../../../shared/components/Modal";
import { useToast } from "../../../../shared/components/ToastProvider";
import { api } from "../../../../shared/libs/api";
import { buildFieldParams, providerApplicationAdmin, reqType } from "../../../../shared/libs/fieldInclude";

type RequirementType = {
  id: string;
  key: string;
  label: string;
  input_type: string;
};

type RequirementItem = {
  id: string;
  status: string;
  value_text?: string | null;
  file_url?: string | null;
  download_url?: string | null;
  comment?: string | null;
  requirement_type?: RequirementType;
};

type ProviderApplicationDetail = {
  id: string;
  status: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  progress_percent?: number | null;
  notes?: string | null;
  items: RequirementItem[];
  user?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  };
};

type Envelope<T> = {
  data: T;
};

const statusTone: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  missing: "bg-slate-100 text-slate-600 border border-slate-200",
  rejected: "bg-rose-50 text-rose-700 border border-rose-200",
};

const ApplicationReviewPage = () => {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [resubmitItem, setResubmitItem] = useState<RequirementItem | null>(null);
  const [resubmitNote, setResubmitNote] = useState("");
  const [rejectItem, setRejectItem] = useState<RequirementItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewItem, setPreviewItem] = useState<RequirementItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [addRequirementOpen, setAddRequirementOpen] = useState(false);
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [newRequirementNote, setNewRequirementNote] = useState("");
  const [editItem, setEditItem] = useState<RequirementItem | null>(null);
  const [editValue, setEditValue] = useState("");

  const applicationQuery = useQuery({
    queryKey: ["admin", "provider-applications", applicationId, "detail"],
    enabled: Boolean(applicationId),
    queryFn: async () => {
      if (!applicationId) {
        throw new Error("Missing application id");
      }
      const response = await api.get<Envelope<ProviderApplicationDetail>>(`/provider-applications/${applicationId}`, {
        params: buildFieldParams(providerApplicationAdmin)
      });
      return response.data.data;
    }
  });

  const requirementTypesQuery = useQuery({
    queryKey: ["admin", "provider-requirements", "definitions"],
    queryFn: async () => {
      const response = await api.get<Envelope<RequirementType[]>>("/requirements", {
        params: buildFieldParams(reqType)
      });
      return response.data.data ?? [];
    }
  });

  const application = applicationQuery.data;
  const items = useMemo(() => application?.items ?? [], [application?.items]);
  const requirementTypes = requirementTypesQuery.data ?? [];
  const requirementsByStatus = useMemo(() => {
    const groups: Record<string, RequirementItem[]> = {};
    items.forEach((item) => {
      const normalized = item.status?.toLowerCase() ?? "missing";
      if (!groups[normalized]) {
        groups[normalized] = [];
      }
      groups[normalized].push(item);
    });
    return groups;
  }, [items]);
  const allVerified = items.length > 0 && items.every((item) => item.status === "verified");

  const clearPreview = useCallback(() => {
    setPreviewItem(null);
    setPreviewError(null);
    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    const endpoint = previewItem?.download_url ?? previewItem?.file_url;
    if (!previewItem || !endpoint) {
      setPreviewLoading(false);
      setPreviewError(previewItem && !endpoint ? "No document available." : null);
      setPreviewUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return null;
      });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setPreviewLoading(true);
    setPreviewError(null);

    api
      .get(endpoint, { responseType: "blob", signal: controller.signal })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const objectUrl = URL.createObjectURL(response.data);
        setPreviewUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return objectUrl;
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        if (isAxiosError(error) && error.code === "ERR_CANCELED") {
          return;
        }
        setPreviewError(error instanceof Error ? error.message : "Unable to load document.");
        setPreviewUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return null;
        });
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
      setPreviewUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return null;
      });
    };
  }, [previewItem]);

  const invalidateApplication = () => {
    if (!applicationId) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["admin", "provider-applications", applicationId, "detail"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "provider-applications"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "providers", "metrics"] });
  };

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({
      itemId,
      status,
      comment
    }: {
      itemId: string;
      status: "verified" | "pending" | "rejected";
      comment?: string;
    }) => {
      if (!applicationId) {
        throw new Error("Missing application id");
      }
      await api.put(`/provider-applications/${applicationId}/items/${itemId}`, {
        status,
        comment: comment?.trim() ? comment.trim() : undefined
      });
    },
    onSuccess: () => {
      invalidateApplication();
      toast.showToast({
        title: variables.status === "verified" ? "Requirement verified" : "Requirement updated",
        description:
          variables.status === "verified"
            ? "Marked as verified."
            : variables.status === "rejected"
            ? "Requirement rejected with notes."
            : "Requirement marked pending.",
        variant: variables.status === "verified" ? "success" : "info"
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to update requirement",
        description: error instanceof Error ? error.message : "Try again shortly.",
        variant: "error"
      });
    }
  });

  const requestResubmissionMutation = useMutation({
    mutationFn: async ({ itemId, note }: { itemId: string; note?: string }) => {
      if (!applicationId) {
        throw new Error("Missing application id");
      }
      await api.post(`/provider-applications/${applicationId}/items/${itemId}/request-resubmission`, note ? { note } : {});
    },
    onSuccess: () => {
      invalidateApplication();
      setResubmitItem(null);
      setResubmitNote("");
      toast.showToast({
        title: "Resubmission requested",
        description: "The provider has been asked to update this requirement.",
        variant: "info"
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to request resubmission",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  });

  const reviewApplicationMutation = useMutation({
    mutationFn: async ({ decision, notes }: { decision: "approved" | "rejected"; notes?: string }) => {
      if (!applicationId) {
        throw new Error("Missing application id");
      }
      await api.post(`/provider-applications/${applicationId}/review`, {
        decision,
        notes: notes?.trim() ? notes.trim() : undefined
      });
    },
    onSuccess: (_, variables) => {
      invalidateApplication();
      toast.showToast({
        title: variables.decision === "approved" ? "Application approved" : "Application rejected",
        description:
          variables.decision === "approved"
            ? "Provider is now verified."
            : "Applicant has been notified of the decision.",
        variant: variables.decision === "approved" ? "success" : "info"
      });
      navigate("/admin/providers/applications");
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Review failed",
        description: error instanceof Error ? error.message : "Ensure all requirements are verified before approving.",
        variant: "error"
      });
    }
  });

  useEffect(() => {
    if (applicationQuery.isError) {
      toast.showToast({
        title: "Unable to load application",
        description: "Return to the queue and try again.",
        variant: "error"
      });
    }
  }, [applicationQuery.isError, toast]);

  const statusSummary = [
    { label: "Pending", value: requirementsByStatus.pending?.length ?? 0 },
    { label: "Verified", value: requirementsByStatus.verified?.length ?? 0 },
    { label: "Rejected", value: requirementsByStatus.rejected?.length ?? 0 },
    { label: "Missing", value: requirementsByStatus.missing?.length ?? 0 }
  ];

  const handleRejectItem = () => {
    if (!rejectItem) {
      return;
    }
    updateItemStatusMutation.mutate({
      itemId: rejectItem.id,
      status: "rejected",
      comment: rejectReason || undefined
    });
    setRejectItem(null);
    setRejectReason("");
  };

  const handleApprove = () => {
    reviewApplicationMutation.mutate({ decision: "approved", notes: decisionNotes });
  };

  const handleRejectApplication = () => {
    if (!decisionNotes.trim()) {
      toast.showToast({
        title: "Add decision notes",
        description: "A rejection note helps the provider understand what to fix.",
        variant: "error"
      });
      return;
    }
    setShowRejectDialog(false);
    reviewApplicationMutation.mutate({ decision: "rejected", notes: decisionNotes || undefined });
  };

  useEffect(() => {
    if (editItem) {
      setEditValue(editItem.value_text ?? "");
    } else {
      setEditValue("");
    }
  }, [editItem]);

  useEffect(() => {
    if (!addRequirementOpen) {
      setSelectedRequirementId("");
      setNewRequirementNote("");
    }
  }, [addRequirementOpen]);

  const addRequirementMutation = useMutation({
    mutationFn: async ({ requirementTypeId, note }: { requirementTypeId: string; note?: string }) => {
      if (!requirementTypeId) {
        throw new Error("Select a requirement to add.");
      }
      if (!applicationId) {
        throw new Error("Missing application id");
      }
      await api.post(`/provider-applications/${applicationId}/requirements`, {
        requirement_type_id: requirementTypeId,
        note: note?.trim() ? note.trim() : undefined
      });
    },
    onSuccess: () => {
      invalidateApplication();
      setAddRequirementOpen(false);
      toast.showToast({
        title: "Requirement added",
        description: "The provider has been notified about the new requirement.",
        variant: "success"
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to add requirement",
        description: error instanceof Error ? error.message : "Try again shortly.",
        variant: "error"
      });
    }
  });

  const updateItemValueMutation = useMutation({
    mutationFn: async ({ itemId, valueText }: { itemId: string; valueText: string }) => {
      if (!applicationId) {
        throw new Error("Missing application id");
      }
      await api.put(`/provider-applications/${applicationId}/items/${itemId}`, {
        value_text: valueText
      });
    },
    onSuccess: (_, variables) => {
      invalidateApplication();
      setEditItem(null);
      toast.showToast({
        title: "Requirement updated",
        description: "The response has been saved.",
        variant: "success"
      });
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to update requirement",
        description: error instanceof Error ? error.message : "Try again shortly.",
        variant: "error"
      });
    }
  });

  if (applicationQuery.isLoading || !application) {
    return <Loading fullHeight />;
  }

  const applicantName =
    application.user?.full_name || application.user?.email || application.user?.id || "Provider applicant";

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Review application</h1>
          <p className="text-sm text-slate-600">Carefully evaluate each requirement before making a decision.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Back to queue
          </Button>
          <Button
            onClick={() => setAddRequirementOpen(true)}
            disabled={requirementTypesQuery.isLoading || requirementTypes.length === 0}
          >
            Add requirement
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">{applicantName}</p>
            <p className="text-xs text-slate-500">Application ID: {application.id}</p>
            {application.submitted_at && (
              <p className="text-xs text-slate-500">
                Submitted {new Date(application.submitted_at).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {statusSummary.map((entry) => (
              <span
                key={entry.label}
                className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
              >
                {entry.label}: {entry.value}
              </span>
            ))}
          </div>
        </div>
        {application.notes && (
          <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Admin note:</span> {application.notes}
          </div>
        )}
      </Card>

      <div className="space-y-4">
        {items.map((item) => {
          const status = item.status?.toLowerCase() ?? "missing";
          const tone = statusTone[status] ?? statusTone.pending;
          const requirementLabel = item.requirement_type?.label ?? "Requirement";
          const requirementType = item.requirement_type?.input_type ?? "text";
          const helpText =
            status === "verified"
              ? "Verified — no further action required."
              : status === "rejected"
              ? "Rejected — provider must resubmit."
              : status === "pending"
              ? "Pending — review the evidence and verify."
              : "Missing — provider has not supplied the requested material.";

          return (
            <Card key={item.id} title={requirementLabel}>
              <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                <div className="space-y-3">
                <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase ${tone}`}>
                  {status.replace(/_/g, " ")}
                </div>
                <p className="text-xs text-slate-500">Type: {requirementType}</p>
                <p className="text-xs text-slate-500">{helpText}</p>
                {item.comment && (
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <span className="font-semibold">Reviewer note:</span> {item.comment}
                  </div>
                )}
                {requirementType === "text" && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {item.value_text || <span className="text-xs text-slate-500">No response provided.</span>}
                  </div>
                )}
                {requirementType !== "text" && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPreviewItem(item)}
                      disabled={!item.download_url && !item.file_url}
                    >
                      View file
                    </Button>
                  </div>
                )}
              </div>
                <div className="flex flex-col gap-2">
                  {requirementType === "text" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditItem(item)}
                      disabled={updateItemValueMutation.isLoading}
                    >
                      Edit response
                    </Button>
                  )}
                  {status !== "verified" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        updateItemStatusMutation.mutate({
                          itemId: item.id,
                          status: "verified"
                        })
                      }
                      disabled={updateItemStatusMutation.isLoading}
                    >
                      Mark verified
                    </Button>
                  )}
                  {status !== "rejected" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setRejectItem(item);
                        setRejectReason("");
                      }}
                      disabled={updateItemStatusMutation.isLoading}
                    >
                      Reject item
                    </Button>
                  )}
                  {(status === "verified" || status === "rejected") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setResubmitItem(item);
                        setResubmitNote("");
                      }}
                      disabled={requestResubmissionMutation.isLoading}
                    >
                      Request resubmission
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Decision notes" description="Notes shared with the provider when you approve or reject.">
        <textarea
          value={decisionNotes}
          onChange={(event) => setDecisionNotes(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          placeholder="Provide context for your decision (optional for approval, required if rejecting the application)."
        />
      </Card>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <span className="text-xs text-slate-500">
            {allVerified
              ? "All requirements verified. Approve the application to verify the provider."
              : "Verify each requirement before approving. You can reject or request resubmission as needed."}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowRejectDialog(true)}
              disabled={reviewApplicationMutation.isLoading}
            >
              Reject application
            </Button>
            <Button
              onClick={handleApprove}
              disabled={!allVerified || reviewApplicationMutation.isLoading}
              loading={reviewApplicationMutation.isLoading}
            >
              Approve application
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={addRequirementOpen}
        onClose={() => setAddRequirementOpen(false)}
        title="Add requirement to application"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Select the requirement to add. The provider will be notified and must complete it before approval.
          </p>
          {requirementTypesQuery.isLoading ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Loading requirement options…
            </div>
          ) : (
            <label className="block text-sm font-medium text-slate-700">
              Requirement
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                value={selectedRequirementId}
                onChange={(event) => setSelectedRequirementId(event.target.value)}
              >
                <option value="">Select requirement</option>
                {requirementTypes.map((requirement) => (
                  <option key={requirement.id} value={requirement.id}>
                    {requirement.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Note to provider (optional)
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              rows={3}
              value={newRequirementNote}
              onChange={(event) => setNewRequirementNote(event.target.value)}
              placeholder="Explain why this requirement was added."
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddRequirementOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                addRequirementMutation.mutate({
                  requirementTypeId: selectedRequirementId,
                  note: newRequirementNote
                })
              }
              disabled={!selectedRequirementId || addRequirementMutation.isLoading}
              loading={addRequirementMutation.isLoading}
            >
              Add requirement
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        title={`Update response — ${editItem?.requirement_type?.label ?? "Requirement"}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Edit the information provided for this requirement. Changes are visible to the provider.
          </p>
          <textarea
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder="Enter the requirement response."
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setEditItem(null);
                setEditValue("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editItem) {
                  updateItemValueMutation.mutate({
                    itemId: editItem.id,
                    valueText: editValue
                  });
                }
              }}
              loading={updateItemValueMutation.isLoading}
            >
              Save changes
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(previewItem)}
        onClose={clearPreview}
        title={previewItem?.requirement_type?.label ?? "Document preview"}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {previewLoading ? (
            <div className="flex h-[70vh] items-center justify-center">
              <Loading />
            </div>
          ) : previewError ? (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{previewError}</div>
          ) : previewUrl ? (
            <iframe
              key={previewUrl}
              src={previewUrl}
              title="Requirement document preview"
              className="h-[70vh] w-full rounded-lg border border-slate-200"
            />
          ) : (
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
              No document available to preview.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={clearPreview}>
              Close
            </Button>
            <Button
              onClick={() => {
                const downloadTarget = previewItem?.download_url ?? previewItem?.file_url ?? null;
                if (downloadTarget) {
                  const resolved =
                    downloadTarget.startsWith("/api/") && typeof window !== "undefined"
                      ? `${window.location.origin}${downloadTarget}`
                      : downloadTarget;
                  window.open(resolved, "_blank", "noopener,noreferrer");
                }
              }}
              disabled={!previewItem || (!previewItem.download_url && !previewItem.file_url)}
            >
              Download
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(resubmitItem)}
        onClose={() => {
          setResubmitItem(null);
          setResubmitNote("");
        }}
        title={`Request resubmission — ${resubmitItem?.requirement_type?.label ?? ""}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Explain what the provider needs to change. They will receive this note alongside the request.
          </p>
          <textarea
            value={resubmitNote}
            onChange={(event) => setResubmitNote(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder="Detail why you need a resubmission."
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setResubmitItem(null);
                setResubmitNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (resubmitItem) {
                  requestResubmissionMutation.mutate({
                    itemId: resubmitItem.id,
                    note: resubmitNote.trim() ? resubmitNote : undefined
                  });
                }
              }}
              loading={requestResubmissionMutation.isLoading}
            >
              Send request
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(rejectItem)}
        onClose={() => {
          setRejectItem(null);
          setRejectReason("");
        }}
        title={`Reject requirement — ${rejectItem?.requirement_type?.label ?? ""}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Provide a note explaining why this requirement is being rejected. The provider will see this note.
          </p>
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder="Share specific feedback."
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setRejectItem(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleRejectItem}
              disabled={!rejectReason.trim()}
              loading={updateItemStatusMutation.isLoading}
            >
              Reject requirement
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={showRejectDialog}
        title="Reject application?"
        description="Share clear notes so the provider understands what to improve."
        confirmLabel="Reject application"
        confirmVariant="secondary"
        loading={reviewApplicationMutation.isLoading}
        onConfirm={handleRejectApplication}
        onClose={() => setShowRejectDialog(false)}
        error={!decisionNotes.trim() ? "Decision notes are required when rejecting the application." : undefined}
      />
    </div>
  );
};

export default ApplicationReviewPage;
