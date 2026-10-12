import type { Provider } from "../schemas/provider";
import type { Facility, FacilityService } from "../schemas/facility";

// What the app can see about whether clients can book a telemedicine consultation. These mirror the
// rules the slot engine applies on the server (a provider must be attached to the facility, have an
// active account, be verified, have telemedicine on, hold an active telemedicine specialty at the
// facility, and have remote or both availability). The server decides in the end; this exists so an
// admin can see which step is missing instead of finding out from a client's "no available slots".

export type Blocker = {
  code:
    | "account_inactive"
    | "not_verified"
    | "telemedicine_off"
    | "no_specialties"
    | "no_availability"
    | "facility_not_active"
    | "no_country"
    | "no_remote_services"
    | "no_providers"
    | "no_ready_provider"
    | "services_not_covered";
  // Short, plain, in the admin's words.
  label: string;
  // What to do about it.
  fix: string;
};

export type ProviderReadiness = { ready: boolean; blockers: Blocker[] };

type ProviderLike = Pick<Provider, "verified" | "telemedicineEnabled" | "user" | "telemedicineSubcategoryAssignments" | "availability">;

// `selectableSubcategoryIds` is the set of active specialties under active categories. A specialty
// that was archived since it was assigned does not count. Pass null while it is still loading.
export const providerTelemedicineReadiness = (
  provider: ProviderLike,
  selectableSubcategoryIds: ReadonlySet<string> | null
): ProviderReadiness => {
  const blockers: Blocker[] = [];
  const status = provider.user?.status;
  if (status && status !== "active") {
    blockers.push({
      code: "account_inactive",
      label: status === "pending" ? "Account setup not finished" : `Account ${status}`,
      fix: status === "pending" ? "The provider needs to finish setting a password from their invitation." : "Reactivate the account."
    });
  }
  if (!provider.verified) {
    blockers.push({ code: "not_verified", label: "Not verified", fix: "Verify the provider." });
  }
  if (!provider.telemedicineEnabled) {
    blockers.push({ code: "telemedicine_off", label: "Telemedicine is off", fix: "Enable telemedicine for this provider." });
  }
  const active = (provider.telemedicineSubcategoryAssignments ?? []).filter((assignment) => assignment.status === "active");
  const usable = selectableSubcategoryIds ? active.filter((assignment) => selectableSubcategoryIds.has(assignment.subcategoryId)) : active;
  if (usable.length === 0) {
    blockers.push({
      code: "no_specialties",
      label: "No telemedicine specialties",
      fix: "Edit the provider and tick their telemedicine specialties. Assigning services alone is not enough."
    });
  }
  const remoteWindows = (provider.availability ?? []).filter((window) => !window.deliveryMode || window.deliveryMode === "remote" || window.deliveryMode === "both");
  if (remoteWindows.length === 0) {
    blockers.push({ code: "no_availability", label: "No remote availability", fix: "The provider sets weekly availability for remote or both." });
  }
  return { ready: blockers.length === 0, blockers };
};

export type ChecklistStep = {
  key: string;
  title: string;
  done: boolean;
  // Shown when not done.
  blocker: Blocker | null;
};

type CatalogServiceLike = { id: string; subcategoryId: string };

// The steps that make a facility bookable for telemedicine, in the order to do them, with the first
// missing step flagged. Nothing here changes data.
export const facilitySetupChecklist = (input: {
  facility: Pick<Facility, "status" | "countryCode">;
  facilityServices: Array<Pick<FacilityService, "active" | "deliveryMode" | "serviceId">>;
  catalogServices: CatalogServiceLike[];
  providers: ProviderLike[];
  selectableSubcategoryIds: ReadonlySet<string> | null;
}): { steps: ChecklistStep[]; complete: boolean; firstMissing: ChecklistStep | null } => {
  const { facility, facilityServices, catalogServices, providers, selectableSubcategoryIds } = input;
  const remote = facilityServices.filter((service) => service.active && (service.deliveryMode === "remote" || service.deliveryMode === "both"));
  const readyProviders = providers.filter((provider) => providerTelemedicineReadiness(provider, selectableSubcategoryIds).ready);
  const readySpecialties = new Set(
    readyProviders.flatMap((provider) => (provider.telemedicineSubcategoryAssignments ?? []).filter((a) => a.status === "active").map((a) => a.subcategoryId))
  );
  const subcategoryByService = new Map(catalogServices.map((service) => [service.id, service.subcategoryId]));
  const covered = remote.filter((service) => {
    const subcategory = subcategoryByService.get(service.serviceId);
    return subcategory ? readySpecialties.has(subcategory) : true;
  });

  const step = (key: string, title: string, done: boolean, blocker: Blocker): ChecklistStep => ({ key, title, done, blocker: done ? null : blocker });
  const steps: ChecklistStep[] = [
    step("status", "Facility is active", facility.status === "active", {
      code: "facility_not_active",
      label: `Facility is ${facility.status}`,
      fix: "Approve the facility. Clients only see active facilities."
    }),
    step("country", "Country is set", Boolean(facility.countryCode), {
      code: "no_country",
      label: "No country set",
      fix: "Set the country on the facility profile. Facilities without one are hidden from clients."
    }),
    step("services", "Telemedicine services are added", remote.length > 0, {
      code: "no_remote_services",
      label: "No telemedicine services",
      fix: "Add telemedicine services to this facility. Clients can only book services listed as remote."
    }),
    step("providers", "Providers are added", providers.length > 0, {
      code: "no_providers",
      label: "No providers",
      fix: "Add the providers who will see clients. A provider belongs to one facility."
    }),
    step("ready", "At least one provider is ready for telemedicine", readyProviders.length > 0, {
      code: "no_ready_provider",
      label: "No provider is ready",
      fix: "Open each provider and clear what is blocking them: verified, account active, telemedicine on, specialties, availability."
    }),
    step("coverage", "Provider specialties cover the telemedicine services", remote.length > 0 && readyProviders.length > 0 && covered.length > 0, {
      code: "services_not_covered",
      label: "No ready provider's specialties match the services",
      fix: "Tick the specialties that match the services you added, or add services from the specialties the providers already have."
    })
  ];
  const firstMissing = steps.find((item) => !item.done) ?? null;
  return { steps, complete: firstMissing === null, firstMissing };
};
