import { useEffect, useRef, useState } from "react";
import { Phone } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { COMPANY_PHONE, COMPANY_PHONE_LOCAL } from "../../../shared/constants/contact";
import { Stepper } from "../../../shared/components/Stepper";
import { careServiceImage } from "../../../shared/utils/careServiceImage";
import type { HomeCareClinic, HomeCareRequestResult, HomeCareService } from "../../../shared/libs/homeCarePublic";
import { DetailsStep } from "../components/homeCare/DetailsStep";
import { DoneStep } from "../components/homeCare/DoneStep";
import { PlaceStep, type VisitPlace } from "../components/homeCare/PlaceStep";
import { ServiceStep } from "../components/homeCare/ServiceStep";
import { TimeStep, type VisitTime } from "../components/homeCare/TimeStep";

const STEPS = [{ title: "Care" }, { title: "Place" }, { title: "Time" }, { title: "Details" }];
// An ambulance is needed now, so there is no time to choose.
const AMBULANCE_STEPS = [{ title: "Service" }, { title: "Place" }, { title: "Details" }];
const REGION_LABELS = ["Choose the care you need", "Confirm where we should come", "Choose a time", "Your details", "Request sent"];

/**
 * Where a visitor who is not signed in asks for a carer to visit them at home. It is a page, not a popup, and it asks as little
 * as it can: the place is read from the device, the nearest clinic that reaches it is picked for them, and a text code takes
 * the place of a password. Payment is after the visit, so there is no payment step.
 */
export const BookHomeCare = () => {
  // The same flow serves an ambulance (?care=ambulance): the services shown are ambulance services, there is no time to
  // choose, and the numbers to call stay at the top for anyone in real danger.
  const [searchParams] = useSearchParams();
  const ambulance = searchParams.get("care") === "ambulance";
  const steps = ambulance ? AMBULANCE_STEPS : STEPS;
  const [step, setStep] = useState(0);
  const [service, setService] = useState<HomeCareService | null>(null);
  const [place, setPlace] = useState<VisitPlace>({ place: null, landmark: "" });
  const [clinics, setClinics] = useState<HomeCareClinic[]>([]);
  const [time, setTime] = useState<VisitTime>({ mode: "asap" });
  const [result, setResult] = useState<HomeCareRequestResult | null>(null);
  const [phoneUsed, setPhoneUsed] = useState("");
  const region = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // A change of step moves the screen reader and the scroll to the new step, as the telemedicine page does.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    region.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step, result]);

  const done = result !== null;
  const stepperCurrent = ambulance ? Math.min(step === 3 ? 2 : step, 2) : Math.min(step, STEPS.length - 1);

  return (
    <section className="container mx-auto px-4 pb-16 pt-4 sm:pt-8 md:px-6">
      <div className={step === 0 && !done ? "w-full" : "mx-auto w-full max-w-2xl"}>
        <h1 className="mb-3 text-xl font-bold tracking-tight text-slate-950 sm:mb-5 sm:text-3xl">{ambulance ? "Request an ambulance" : "Book home care"}</h1>

        {ambulance && !done && (
          <div className="mb-5 rounded-2xl border-2 border-tiba-blue bg-white p-4" role="note">
            <p className="mb-3 font-semibold text-slate-900">
              Need an ambulance? Book now below, or call {COMPANY_PHONE_LOCAL} <span className="font-normal text-slate-600">(non-emergency)</span>
            </p>
            <a
              href={`tel:${COMPANY_PHONE}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-tiba-blue px-4 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call {COMPANY_PHONE_LOCAL}
            </a>
          </div>
        )}

        {!done && (
          <div className="mb-5">
            <Stepper steps={steps} current={stepperCurrent} compactOnMobile showDescriptions={false} />
          </div>
        )}

        {!done && step > 0 && service && (
          <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <img src={careServiceImage(service)} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" />
            <span className="font-semibold text-slate-900">{service.name}</span>
            <button type="button" className="min-h-[44px] font-semibold text-tiba-blue underline underline-offset-2" onClick={() => setStep(0)}>
              Change
            </button>
          </p>
        )}

        <div ref={region} role="region" aria-label={REGION_LABELS[done ? 4 : step]} tabIndex={-1} className="outline-none">
          {done && result && service && <DoneStep result={result} serviceName={service.name} phone={phoneUsed} ambulance={ambulance} />}

          {!done && step === 0 && (
            <ServiceStep
              kind={ambulance ? "ambulance" : "home"}
              onChoose={(chosen) => {
                if (service?.id !== chosen.id) setClinics([]);
                setService(chosen);
                setStep(1);
              }}
            />
          )}

          {!done && step === 1 && service && (
            <PlaceStep
              service={service}
              value={place}
              onChange={setPlace}
              onContinue={(reaching) => {
                setClinics(reaching);
                setStep(ambulance ? 3 : 2);
              }}
            />
          )}

          {!done && step === 2 && <TimeStep value={time} onContinue={(chosen) => { setTime(chosen); setStep(3); }} />}

          {!done && step === 3 && service && place.place && clinics[0] && (
            <DetailsStep
              serviceId={service.id}
              facilityId={clinics[0].id}
              place={{ ...place.place.coords, address: place.place.name, landmark: place.landmark }}
              scheduledAt={time.mode === "later" ? new Date(time.at).toISOString() : null}
              onDone={(created, phone) => {
                setResult(created);
                setPhoneUsed(phone);
              }}
            />
          )}
        </div>

        {!done && step > 0 && (
          <button
            type="button"
            className="mt-4 min-h-[44px] font-semibold text-slate-600 underline underline-offset-2"
            onClick={() => setStep(ambulance && step === 3 ? 1 : step - 1)}
          >
            Back
          </button>
        )}
      </div>
    </section>
  );
};

export default BookHomeCare;
