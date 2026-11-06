import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { FacilityDocumentsPanel } from "./FacilityDocumentsPanel";
import { facilityDocumentsKey, fetchFacilityDocuments } from "./facilityDocumentsApi";

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue";

/** One facility's documents for the super admin: add for them, approve, or send back with a reason. */
export const FacilityDocumentsReviewPage = () => {
  const { facilityId = "" } = useParams<{ facilityId: string }>();
  // Shares its answer with the panel below, so the facility is asked for once.
  const query = useQuery({ queryKey: facilityDocumentsKey(facilityId), queryFn: () => fetchFacilityDocuments(facilityId), enabled: Boolean(facilityId) });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <Link to="/admin/documents/facilities" className={`inline-flex min-h-[44px] w-fit items-center gap-1 rounded-lg text-sm font-medium text-tiba-blue ${focusRing}`}>
        <ArrowBackIcon aria-hidden fontSize="small" />
        All facilities
      </Link>
      <header>
        <h1 className="text-xl font-semibold text-slate-900">{query.data?.facility.name ?? "Facility documents"}</h1>
        <p className="mt-1 text-sm text-slate-600">Approve each document, or send it back with what to fix. You can also add a document for the facility.</p>
      </header>
      {facilityId && <FacilityDocumentsPanel facilityId={facilityId} mode="super_admin" />}
    </div>
  );
};

export default FacilityDocumentsReviewPage;
