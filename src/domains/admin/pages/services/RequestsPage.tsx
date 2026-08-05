import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GridColDef } from "@mui/x-data-grid";

import { Button } from "../../../../shared/components/Button";
import { Card } from "../../../../shared/components/Card";
import { DataGrid } from "../../../../shared/components/DataGrid";
import { Input } from "../../../../shared/components/Input";
import { Modal } from "../../../../shared/components/Modal";
import { useToast } from "../../../../shared/components/ToastProvider";
import { api } from "../../../../shared/libs/api";
import {
  approveServiceRequest,
  fetchServiceRequests,
  rejectServiceRequest
} from "../../../../shared/libs/serviceRequests";
import { STATUS_LABELS, type ServiceRequest, type ServiceRequestStatus } from "../../../../shared/schemas/serviceRequest";

type Envelope<T> = {
  data: T;
};

type CatalogService = {
  id: string;
  key: string;
  name: string;
  base_price_cents: number;
  default_estimate_minutes: number;
  active: boolean;
};

type ServiceCategory = {
  id: string;
  key: string;
  name: string;
};

const useCatalogServicesQuery = () =>
  useQuery({
    queryKey: ["admin", "services", "catalog", "active"],
    queryFn: async () => {
      const response = await api.get<Envelope<CatalogService[]>>("/services", { params: { "filter[active]": "true" } });
      return response.data.data;
    }
  });

const useCategoriesQuery = () =>
  useQuery({
    queryKey: ["admin", "service-categories"],
    queryFn: async () => {
      const response = await api.get<Envelope<ServiceCategory[]>>("/service-categories");
      return response.data.data;
    }
  });

type ApproveMode = "select" | "create";

type ApproveFormState = {
  mode: ApproveMode;
  serviceId: string;
  categoryId: string;
  key: string;
  name: string;
  basePrice: string;
  defaultEstimateMinutes: string;
  priceCents: string;
  decisionNote: string;
};

export const slugifyKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || `service_${Date.now()}`;

export const buildApproveForm = (request: ServiceRequest): ApproveFormState => ({
  mode: "create",
  serviceId: "",
  categoryId: request.proposedCategoryId ?? "",
  key: slugifyKey(request.proposedName),
  name: request.proposedName,
  basePrice: "",
  defaultEstimateMinutes: "60",
  priceCents: "",
  decisionNote: ""
});

const statusFilters: Array<{ value: ServiceRequestStatus | "all"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" }
];

export const ServiceRequestsPanel = () => {
  const [statusFilter, setStatusFilter] = useState<ServiceRequestStatus | "all">("pending");
  const [approveTarget, setApproveTarget] = useState<ServiceRequest | null>(null);
  const [approveForm, setApproveForm] = useState<ApproveFormState | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ServiceRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const toast = useToast();
  const queryClient = useQueryClient();

  const requestsQuery = useQuery({
    queryKey: ["admin", "service-requests", statusFilter],
    queryFn: () => fetchServiceRequests(statusFilter === "all" ? undefined : { status: statusFilter })
  });
  const { data: catalogServices } = useCatalogServicesQuery();
  const { data: categories } = useCategoriesQuery();

  const invalidateRequests = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "service-requests"] });
  };

  const approveMutation = useMutation({
    mutationFn: ({ request, form }: { request: ServiceRequest; form: ApproveFormState }) => {
      if (form.mode === "select") {
        return approveServiceRequest(request.id, {
          serviceId: form.serviceId,
          priceCents: form.priceCents ? Math.round(Number(form.priceCents) * 100) : undefined,
          decisionNote: form.decisionNote.trim() || undefined
        });
      }
      return approveServiceRequest(request.id, {
        categoryId: form.categoryId,
        key: form.key.trim(),
        name: form.name.trim(),
        basePriceCents: Math.round(Number(form.basePrice || "0") * 100),
        defaultEstimateMinutes: Number(form.defaultEstimateMinutes || "60"),
        decisionNote: form.decisionNote.trim() || undefined
      });
    },
    onSuccess: () => {
      toast.showToast({ title: "Service request approved", variant: "success" });
      invalidateRequests();
      setApproveTarget(null);
      setApproveForm(null);
      setApproveError(null);
    },
    onError: (error: unknown) => {
      setApproveError(error instanceof Error ? error.message : "Unable to approve this request.");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ request, note }: { request: ServiceRequest; note: string }) =>
      rejectServiceRequest(request.id, note.trim() || undefined),
    onSuccess: () => {
      toast.showToast({ title: "Service request rejected", variant: "success" });
      invalidateRequests();
      setRejectTarget(null);
      setRejectNote("");
    },
    onError: (error: unknown) => {
      toast.showToast({
        title: "Unable to reject this request",
        description: error instanceof Error ? error.message : "Please try again shortly.",
        variant: "error"
      });
    }
  });

  const openApprove = (request: ServiceRequest) => {
    setApproveTarget(request);
    setApproveForm(buildApproveForm(request));
    setApproveError(null);
  };

  const rows = useMemo(
    () =>
      (requestsQuery.data ?? []).map((request) => ({
        id: request.id,
        request,
        facilityName: request.facilityName ?? request.facilityId,
        proposedName: request.proposedName,
        requestedByName: request.requestedByName ?? "Unknown",
        status: STATUS_LABELS[request.status],
        rawStatus: request.status,
        rationale: request.rationale,
        createdAt: request.createdAt ? new Date(request.createdAt).toLocaleString() : "—"
      })),
    [requestsQuery.data]
  );

  const columns: GridColDef[] = [
    { field: "proposedName", headerName: "Proposed service", flex: 1, minWidth: 200 },
    { field: "facilityName", headerName: "Facility", minWidth: 180 },
    { field: "requestedByName", headerName: "Requested by", minWidth: 160 },
    { field: "rationale", headerName: "Rationale", flex: 1.4, minWidth: 240 },
    { field: "status", headerName: "Status", minWidth: 130 },
    { field: "createdAt", headerName: "Submitted", minWidth: 170 },
    {
      field: "actions",
      headerName: "",
      minWidth: 200,
      sortable: false,
      renderCell: (params) =>
        params.row.rawStatus === "pending" ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => openApprove(params.row.request)}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejectTarget(params.row.request)}>
              Reject
            </Button>
          </div>
        ) : null
    }
  ];

  return (
    <div className="space-y-6">
      <Card
        title="Service requests"
        description="Review facility requests to add a service that does not exist in the catalog yet."
      >
        <div className="flex flex-wrap items-center gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                statusFilter === filter.value
                  ? "border-primary-200 bg-primary-50 text-primary-800"
                  : "border-slate-200 text-slate-600 hover:text-primary-600"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Requests" padding="none">
        <DataGrid rows={rows} columns={columns} loading={requestsQuery.isFetching} />
      </Card>

      <Modal
        open={Boolean(approveTarget && approveForm)}
        onClose={() => {
          if (!approveMutation.isPending) {
            setApproveTarget(null);
            setApproveForm(null);
          }
        }}
        title={approveTarget ? `Approve "${approveTarget.proposedName}"` : "Approve request"}
      >
        {approveTarget && approveForm && (
          <div className="flex flex-col gap-4">
            <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white p-1 text-sm font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setApproveForm((current) => (current ? { ...current, mode: "create" } : current))}
                className={`rounded-full px-3 py-1 ${approveForm.mode === "create" ? "bg-primary-50 text-primary-800" : ""}`}
              >
                Create new service
              </button>
              <button
                type="button"
                onClick={() => setApproveForm((current) => (current ? { ...current, mode: "select" } : current))}
                className={`rounded-full px-3 py-1 ${approveForm.mode === "select" ? "bg-primary-50 text-primary-800" : ""}`}
              >
                Use existing service
              </button>
            </div>

            {approveForm.mode === "select" ? (
              <>
                <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
                  <span>Existing catalog service</span>
                  <select
                    value={approveForm.serviceId}
                    onChange={(event) =>
                      setApproveForm((current) => (current ? { ...current, serviceId: event.target.value } : current))
                    }
                    className="h-[50px] rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
                  >
                    <option value="">Select service</option>
                    {catalogServices?.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Facility price override (KES, optional)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={approveForm.priceCents}
                  onChange={(event) =>
                    setApproveForm((current) => (current ? { ...current, priceCents: event.target.value } : current))
                  }
                />
              </>
            ) : (
              <>
                <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
                  <span>Category</span>
                  <select
                    value={approveForm.categoryId}
                    onChange={(event) =>
                      setApproveForm((current) => (current ? { ...current, categoryId: event.target.value } : current))
                    }
                    className="h-[50px] rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm focus:border-tiba-blue focus:outline-none focus:ring-2 focus:ring-tiba-blue/20"
                  >
                    <option value="">Select category</option>
                    {categories?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Service name"
                  value={approveForm.name}
                  onChange={(event) =>
                    setApproveForm((current) => (current ? { ...current, name: event.target.value } : current))
                  }
                />
                <Input
                  label="Key"
                  value={approveForm.key}
                  onChange={(event) =>
                    setApproveForm((current) => (current ? { ...current, key: event.target.value } : current))
                  }
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Base price (KES)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={approveForm.basePrice}
                    onChange={(event) =>
                      setApproveForm((current) => (current ? { ...current, basePrice: event.target.value } : current))
                    }
                  />
                  <Input
                    label="Default duration (minutes)"
                    type="number"
                    min="1"
                    value={approveForm.defaultEstimateMinutes}
                    onChange={(event) =>
                      setApproveForm((current) =>
                        current ? { ...current, defaultEstimateMinutes: event.target.value } : current
                      )
                    }
                  />
                </div>
              </>
            )}

            <Input
              label="Decision note (optional)"
              value={approveForm.decisionNote}
              onChange={(event) =>
                setApproveForm((current) => (current ? { ...current, decisionNote: event.target.value } : current))
              }
            />

            <p className="text-xs text-slate-500">
              The facility offering is created inactive. Admin ops must set the facility price and activate it before
              clients can discover it.
            </p>

            {approveError && <p className="text-sm text-danger-600">{approveError}</p>}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={approveMutation.isPending}
                onClick={() => {
                  setApproveTarget(null);
                  setApproveForm(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                loading={approveMutation.isPending}
                onClick={() => {
                  if (approveForm.mode === "select" && !approveForm.serviceId) {
                    setApproveError("Select an existing catalog service.");
                    return;
                  }
                  if (approveForm.mode === "create" && (!approveForm.categoryId || !approveForm.name.trim())) {
                    setApproveError("Select a category and enter a service name.");
                    return;
                  }
                  approveMutation.mutate({ request: approveTarget, form: approveForm });
                }}
              >
                Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => {
          if (!rejectMutation.isPending) {
            setRejectTarget(null);
            setRejectNote("");
          }
        }}
        title={rejectTarget ? `Reject "${rejectTarget.proposedName}"` : "Reject request"}
        maxWidth="sm"
      >
        {rejectTarget && (
          <div className="flex flex-col gap-4">
            <Input
              label="Decision note (optional)"
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              placeholder="Explain why this request was rejected"
            />
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={rejectMutation.isPending}
                onClick={() => {
                  setRejectTarget(null);
                  setRejectNote("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                loading={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ request: rejectTarget, note: rejectNote })}
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const ServiceRequestsPage = () => <ServiceRequestsPanel />;

export default ServiceRequestsPage;
