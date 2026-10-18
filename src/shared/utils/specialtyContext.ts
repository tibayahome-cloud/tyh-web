// What an admin needs to see next to a telemedicine specialty when choosing it for a provider: which
// services this facility offers under it, and how many providers already hold it. A service is added
// to a facility by name, but a provider is assigned by specialty, so without this the new service an
// admin just added is nowhere to be found on the provider's screen.

type FacilityServiceLike = { serviceId: string; active: boolean; service?: { name?: string | null } | null };
type CatalogServiceLike = { id: string; subcategoryId: string; name: string };
type ProviderLike = { telemedicineSubcategoryAssignments: Array<{ subcategoryId: string; status: string }> };

// specialty id -> names of the active services this facility offers under it.
export const offeredServicesBySpecialty = (
  facilityServices: FacilityServiceLike[],
  catalogServices: CatalogServiceLike[]
): Map<string, string[]> => {
  const bySpecialty = new Map<string, string[]>();
  const catalog = new Map(catalogServices.map((service) => [service.id, service]));
  facilityServices.forEach((offering) => {
    if (!offering.active) return;
    const service = catalog.get(offering.serviceId);
    if (!service?.subcategoryId) return;
    const name = offering.service?.name?.trim() || service.name;
    bySpecialty.set(service.subcategoryId, [...(bySpecialty.get(service.subcategoryId) ?? []), name]);
  });
  return bySpecialty;
};

// specialty id -> how many of these providers hold it with an active assignment.
export const holdersBySpecialty = (providers: ProviderLike[]): Map<string, number> => {
  const counts = new Map<string, number>();
  providers.forEach((provider) => {
    new Set(provider.telemedicineSubcategoryAssignments.filter((a) => a.status === "active").map((a) => a.subcategoryId)).forEach((id) =>
      counts.set(id, (counts.get(id) ?? 0) + 1)
    );
  });
  return counts;
};
