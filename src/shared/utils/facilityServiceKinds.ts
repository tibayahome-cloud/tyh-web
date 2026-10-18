// A facility offers two kinds of service that are set up and priced separately: home-based care
// (the platform's normal services) and telemedicine (the specialty-based remote consultations).
// A telemedicine service is always remote; home-based services are in person, or sometimes both.

export type ServiceKind = "home" | "telemedicine";

export const SERVICE_KIND_LABEL: Record<ServiceKind, string> = {
  home: "Home-based care",
  telemedicine: "Telemedicine"
};

export const splitServicesByKind = <T extends { serviceId: string }>(
  services: T[],
  telemedicineServiceIds: ReadonlySet<string>
): { home: T[]; telemedicine: T[] } => ({
  home: services.filter((service) => !telemedicineServiceIds.has(service.serviceId)),
  telemedicine: services.filter((service) => telemedicineServiceIds.has(service.serviceId))
});

// Home-based care first, unless the facility offers only telemedicine, in which case the empty tab
// would hide everything it has.
export const defaultServiceKind = (homeCount: number, telemedicineCount: number): ServiceKind =>
  homeCount === 0 && telemedicineCount > 0 ? "telemedicine" : "home";
