import { Skeleton } from "../../../../shared/components/Skeleton";
import { useAdminFacilityScope } from "../finance/paymentAccess";
import { FacilityDocumentsPanel } from "./FacilityDocumentsPanel";

/** The facility admin's own checklist: what the facility has to show, and where each document stands. */
export const OurDocumentsPage = () => {
  const scope = useAdminFacilityScope(true);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Our documents</h1>
        <p className="mt-1 text-sm text-slate-600">
          What {scope.facility?.name ?? "your facility"} shows to prove it is legitimate. Add each document, send them for review, and we will tell you when they are approved.
        </p>
      </header>
      {scope.isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading documents">
          <Skeleton height={120} rounded="lg" />
          <Skeleton height={96} rounded="lg" />
        </div>
      ) : scope.facility ? (
        <FacilityDocumentsPanel facilityId={scope.facility.id} mode="facility_admin" />
      ) : (
        <p role="alert" className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          We could not tell which facility you manage. If you are a super admin, open a facility from the Facilities tab instead.
        </p>
      )}
    </div>
  );
};

export default OurDocumentsPage;
