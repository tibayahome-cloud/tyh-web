/**
 * The public page where a visitor with no account asks for a carer to visit them at home.
 *
 * It asks as little as it can: the place is read from the device, the nearest clinic that reaches it is picked, and a texted
 * code replaces a password. Payment is after the visit, so there is no payment step. The API calls are replaced; what is
 * pinned here is what the visitor sees and what the page sends.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchHomeCareServices: vi.fn(),
  fetchHomeCareCoverage: vi.fn(),
  sendHomeCareCode: vi.fn(),
  createHomeCareRequest: vi.fn()
}));

vi.mock("../../../../shared/libs/homeCarePublic", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../shared/libs/homeCarePublic")>()),
  ...api
}));

vi.mock("../../../../shared/utils/geocoding", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../shared/utils/geocoding")>()),
  describePlace: vi.fn(async () => ({ address: "Argwings Kodhek Road, Kilimani, Nairobi", plusCode: "7GRP+J3 Nairobi" }))
}));

// The real picker draws a Google map and searches Google Places; here it only shows the chosen place and lets a test change it.
vi.mock("../../../client/components/PlacePicker", () => ({
  PlacePicker: ({ value, onChange }: { value: { name: string } | null; onChange: (place: { name: string; coords: { lat: number; lng: number } }) => void }) => (
    <div>
      <p data-testid="chosen-place">{value ? value.name : "no place yet"}</p>
      <button type="button" onClick={() => onChange({ name: "Pinned location", coords: { lat: -1.3, lng: 36.8 } })}>
        Pin somewhere unnamed
      </button>
    </div>
  )
}));

import { BookHomeCare } from "../BookHomeCare";

const SERVICES = [
  { id: "svc-wound", name: "Wound dressing", description: "Dressing at home", base_price_cents: 100000, default_estimate_minutes: 45, category: { id: "c-nurse", name: "Nursing" } },
  { id: "svc-physio", name: "Physiotherapy", description: "Exercises at home", base_price_cents: 200000, default_estimate_minutes: 60, category: { id: "c-rehab", name: "Rehabilitation" } }
];
const CLINIC = { id: "fac-1", name: "Kilimani Clinic", distance_km: 3.8, price_cents: 250000, currency: "KES", estimate_duration_minutes: 45 };

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <BookHomeCare />
      </MemoryRouter>
    </QueryClientProvider>
  );

const allowLocation = () =>
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: -1.2921, longitude: 36.8219, accuracy: 20 } })
    }
  });
const refuseLocation = () =>
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) => fail({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3 }) }
  });

const reachPlaceStep = async (user: ReturnType<typeof userEvent.setup>, name = "Wound dressing") => {
  renderPage();
  await user.click(await screen.findByRole("button", { name: new RegExp(name) }));
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.fetchHomeCareServices.mockResolvedValue(SERVICES);
  api.fetchHomeCareCoverage.mockResolvedValue({ covered: true, service_id: "svc-wound", facilities: [CLINIC] });
  allowLocation();
  window.scrollTo = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe("choosing the care", () => {
  it("is a page with a heading, not a popup, and lists the services", async () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Book home care" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Wound dressing/ })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("narrows the list by search and by kind of care", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: /Wound dressing/ });

    await user.click(screen.getByRole("button", { name: "Rehabilitation" }));
    expect(screen.queryByRole("button", { name: /Wound dressing/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Physiotherapy/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All care" }));
    await user.type(screen.getByRole("searchbox", { name: "Search care" }), "dressing");
    expect(screen.getByRole("button", { name: /Wound dressing/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Physiotherapy/ })).not.toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Search care" }));
    await user.type(screen.getByRole("searchbox", { name: "Search care" }), "zzz");
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });

  it("says what to do when no service is open for booking", async () => {
    api.fetchHomeCareServices.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/No home care services are open for booking online/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\+254 712 444 422/ })).toHaveAttribute("href", "tel:+254712444422");
  });

  it("says what failed and offers a retry when the services cannot load", async () => {
    api.fetchHomeCareServices.mockRejectedValueOnce(new Error("down")).mockResolvedValue(SERVICES);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /retry|try again/i }));
    expect(await screen.findByRole("button", { name: /Wound dressing/ })).toBeInTheDocument();
  });
});

describe("the place", () => {
  it("reads the device location, names it, checks coverage and shows the clinic and the price after the visit", async () => {
    const user = userEvent.setup();
    await reachPlaceStep(user);

    expect(await screen.findByText("We can reach you.")).toBeInTheDocument();
    expect(screen.getByTestId("chosen-place")).toHaveTextContent("Argwings Kodhek Road, Kilimani, Nairobi");
    expect(screen.getByText(/Kilimani Clinic is 3\.8 km away/)).toHaveTextContent(/paid after the visit/);
    expect(api.fetchHomeCareCoverage).toHaveBeenCalledWith("svc-wound", { lat: -1.2921, lng: 36.8219 }, expect.anything());
    expect(screen.getByRole("button", { name: "Yes, come here" })).toBeEnabled();
  });

  it("does not offer a price of zero", async () => {
    api.fetchHomeCareCoverage.mockResolvedValue({ covered: true, service_id: "svc-wound", facilities: [{ ...CLINIC, price_cents: 0 }] });
    const user = userEvent.setup();
    await reachPlaceStep(user);

    expect(await screen.findByText(/The clinic confirms the price/)).toBeInTheDocument();
    expect(screen.queryByText(/KES\s?0\b/)).not.toBeInTheDocument();
  });

  it("says when no clinic reaches the place and gives the phone number, and does not continue", async () => {
    api.fetchHomeCareCoverage.mockResolvedValue({ covered: false, service_id: "svc-wound", facilities: [] });
    const user = userEvent.setup();
    await reachPlaceStep(user);

    expect(await screen.findByText("No clinic visits this place yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\+254 712 444 422/ })).toHaveAttribute("href", "tel:+254712444422");
    expect(screen.getByRole("button", { name: "Yes, come here" })).toBeDisabled();
  });

  it("explains a refused location and does not continue until a place is chosen", async () => {
    refuseLocation();
    const user = userEvent.setup();
    await reachPlaceStep(user);

    expect(await screen.findByText(/did not share your location/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, come here" })).toBeDisabled();
    expect(api.fetchHomeCareCoverage).not.toHaveBeenCalled();
  });

  it("asks for a street or landmark when the place has no real name", async () => {
    const user = userEvent.setup();
    await reachPlaceStep(user);
    await screen.findByText("We can reach you.");

    await user.click(screen.getByRole("button", { name: "Pin somewhere unnamed" }));
    expect(await screen.findByText(/Tell us the street or a landmark/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, come here" })).toBeDisabled();

    await user.type(screen.getByLabelText(/Street, gate or landmark/), "Opposite the petrol station");
    expect(screen.getByRole("button", { name: "Yes, come here" })).toBeEnabled();
  });

  it("goes back to the care step with Change", async () => {
    const user = userEvent.setup();
    await reachPlaceStep(user);
    await screen.findByText("We can reach you.");

    await user.click(screen.getByRole("button", { name: "Change" }));

    expect(await screen.findByRole("heading", { name: "What care do you need at home?" })).toBeInTheDocument();
  });
});

describe("the time", () => {
  it("defaults to as soon as possible, and a chosen time must be at least two hours away", async () => {
    const user = userEvent.setup();
    await reachPlaceStep(user);
    await user.click(await screen.findByRole("button", { name: "Yes, come here" }));

    expect(await screen.findByRole("heading", { name: "When should we come?" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /As soon as possible/ })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /On a day and time I choose/ }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});

describe("the details and the code", () => {
  const reachDetails = async (user: ReturnType<typeof userEvent.setup>) => {
    await reachPlaceStep(user);
    await user.click(await screen.findByRole("button", { name: "Yes, come here" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Who is the visit for?" });
  };
  const fillDetails = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText(/Full name/), "Amina Wanjiru");
    await user.type(screen.getByLabelText(/Phone number/), "0712345678");
  };

  it("asks for the code only after the details and the agreement, then sends the request and shows the reference", async () => {
    api.sendHomeCareCode.mockResolvedValue({ status: "sent", expires_in: 600, resend_after: 120 });
    api.createHomeCareRequest.mockResolvedValue({
      booking_id: "abcd1234-0000", reference: "abcd1234", status: "broadcasting", scheduled_at: null,
      facility: { id: "fac-1", name: "Kilimani Clinic" }, price_cents: 250000, currency: "KES", account_created: true
    });
    const user = userEvent.setup();
    await reachDetails(user);

    expect(screen.getByRole("button", { name: "Text me a code" })).toBeDisabled();
    await fillDetails(user);
    expect(screen.getByRole("button", { name: "Text me a code" })).toBeDisabled(); // not agreed yet
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Text me a code" }));

    expect(api.sendHomeCareCode).toHaveBeenCalledWith({ phone: "0712345678", service_id: "svc-wound", lat: -1.2921, lng: 36.8219 });
    const code = await screen.findByLabelText(/6-digit code/);
    expect(screen.getByRole("button", { name: "Request my visit" })).toBeDisabled();
    await user.type(code, "123456");
    await user.click(screen.getByRole("button", { name: "Request my visit" }));

    expect(api.createHomeCareRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "0712345678", code: "123456", full_name: "Amina Wanjiru", service_id: "svc-wound", facility_id: "fac-1",
        lat: -1.2921, lng: 36.8219, address_text: "Argwings Kodhek Road, Kilimani, Nairobi", scheduled_at: null,
        legal_documents: expect.arrayContaining([{ type: "terms", version: expect.any(String) }])
      })
    );
    expect(await screen.findByRole("heading", { name: "Your visit is requested" })).toBeInTheDocument();
    expect(screen.getByText("ABCD1234")).toBeInTheDocument();
    expect(screen.getByText(/Kilimani Clinic/)).toBeInTheDocument();
    expect(screen.getByText(/will call 0712345678/)).toBeInTheDocument();
  });

  it("sends a person whose number already has an account to sign in, with no code field", async () => {
    api.sendHomeCareCode.mockResolvedValue({ status: "sign_in", expires_in: 600, resend_after: 120 });
    const user = userEvent.setup();
    await reachDetails(user);
    await fillDetails(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Text me a code" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/already has an account/)).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByLabelText(/6-digit code/)).not.toBeInTheDocument();
  });

  it("says to call when codes cannot be texted right now", async () => {
    api.sendHomeCareCode.mockRejectedValue({
      isAxiosError: true,
      response: { status: 503, data: { error: { message: "We cannot text codes right now. Please call us to book your visit.", details: { code: "codes_unavailable" } } } }
    });
    const user = userEvent.setup();
    await reachDetails(user);
    await fillDetails(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Text me a code" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/cannot text codes right now/)).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: /\+254 712 444 422/ })).toHaveAttribute("href", "tel:+254712444422");
  });

  it("keeps the code field and says how many tries are left after a wrong code, and asks for a new code once it has expired", async () => {
    api.sendHomeCareCode.mockResolvedValue({ status: "sent", expires_in: 600, resend_after: 120 });
    api.createHomeCareRequest
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 400, data: { error: { message: "That code is not right. 4 tries left.", details: { code: "code_wrong" } } } } })
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 400, data: { error: { message: "That code has expired. Ask for a new one.", details: { code: "code_expired" } } } } });
    const user = userEvent.setup();
    await reachDetails(user);
    await fillDetails(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Text me a code" }));

    await user.type(await screen.findByLabelText(/6-digit code/), "111111");
    await user.click(screen.getByRole("button", { name: "Request my visit" }));
    expect(await screen.findByText("That code is not right. 4 tries left.")).toBeInTheDocument();
    expect(screen.getByLabelText(/6-digit code/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Request my visit" }));
    expect(await screen.findByText(/has expired/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Text me a code" })).toBeInTheDocument());
  });
});
