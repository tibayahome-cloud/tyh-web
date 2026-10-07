import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateFacilityMock = vi.fn();
const updateFacilityStatusMock = vi.fn();

vi.mock("../../../../shared/libs/facilities", () => ({
  updateFacility: (...args: unknown[]) => updateFacilityMock(...args),
  updateFacilityStatus: (...args: unknown[]) => updateFacilityStatusMock(...args)
}));

import type { Facility } from "../../../../shared/schemas/facility";
import { FacilityProfileCard } from "../FacilityProfileCard";

const facility: Facility = {
  id: "f-1",
  name: "Karen Clinic",
  facilityType: "clinic",
  hospitalLevel: null,
  address: "Karen, Nairobi",
  county: "Nairobi",
  countryCode: "KE",
  email: "front@karen.test",
  status: "active",
  lat: null,
  lng: null,
  platformFeePercent: 12,
  providerFinancialsVisible: true,
  fastResponseEnabled: false,
  approvedAt: null,
  suspendedAt: null,
  phones: [],
  operatingHours: [],
  services: [],
  admins: []
};

const rejection = (status: number, message: string) =>
  new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: { error: { code: status, name: "x", message } }
  });

const setup = (props: Partial<React.ComponentProps<typeof FacilityProfileCard>> = {}) => {
  const onSaved = vi.fn();
  const onEditContactAndHours = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <FacilityProfileCard facility={facility} onSaved={onSaved} onEditContactAndHours={onEditContactAndHours} {...props} />
    </QueryClientProvider>
  );
  return { onSaved, onEditContactAndHours, ...view };
};

describe("FacilityProfileCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateFacilityMock.mockResolvedValue(facility);
    updateFacilityStatusMock.mockResolvedValue(facility);
  });

  it("shows the saved values with the fee as a percentage and no form until editing starts", () => {
    setup();
    expect(screen.getByText("Karen Clinic")).toBeInTheDocument();
    expect(screen.getByText("12% of each payment")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: /edit facility profile/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Editing")).not.toBeInTheDocument();
  });

  it("enters edit mode, then cancel leaves it and discards typed changes", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /edit facility profile/i }));
    expect(screen.getByText("Editing")).toBeInTheDocument();

    const name = screen.getByLabelText("Facility name");
    await user.clear(name);
    await user.type(name, "Something else");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Editing")).not.toBeInTheDocument();
    expect(screen.getByText("Karen Clinic")).toBeInTheDocument();
    expect(updateFacilityMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /edit facility profile/i }));
    expect(screen.getByLabelText("Facility name")).toHaveValue("Karen Clinic");
  });

  it("Escape also leaves edit mode", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /edit facility profile/i }));
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Editing")).not.toBeInTheDocument();
  });

  it("saves only the changed fields, reports success, leaves edit mode and asks the page to reload", async () => {
    const user = userEvent.setup();
    const { onSaved } = setup();
    await user.click(screen.getByRole("button", { name: /edit facility profile/i }));
    const name = screen.getByLabelText("Facility name");
    await user.clear(name);
    await user.type(name, "Karen Family Clinic");
    const fee = screen.getByLabelText(/platform fee/i);
    await user.clear(fee);
    await user.type(fee, "15");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateFacilityMock).toHaveBeenCalledTimes(1));
    expect(updateFacilityMock).toHaveBeenCalledWith("f-1", { name: "Karen Family Clinic", platformFeePercent: 15 });
    expect(updateFacilityStatusMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Facility profile saved.")).toBeInTheDocument();
    expect(screen.queryByText("Editing")).not.toBeInTheDocument();
    expect(onSaved).toHaveBeenCalled();
  });

  it.each(["-5", "101", "abc"])("blocks a platform fee of %s before anything is sent", async (value) => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /edit facility profile/i }));
    const fee = screen.getByLabelText(/platform fee/i);
    await user.clear(fee);
    await user.type(fee, value);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/percentage from 0 to 100/i)).toBeInTheDocument();
    expect(fee).toHaveAttribute("aria-invalid", "true");
    expect(updateFacilityMock).not.toHaveBeenCalled();
    expect(screen.getByText("Editing")).toBeInTheDocument();
  });

  it("sends a status change to the status endpoint after the core update", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /edit facility profile/i }));
    await user.selectOptions(screen.getByLabelText("Status"), "suspended");
    expect(screen.getByText(/Status will change from Active to Suspended/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateFacilityStatusMock).toHaveBeenCalledWith("f-1", "suspended"));
    expect(updateFacilityMock).not.toHaveBeenCalled();
  });

  it("keeps edit mode and shows a server rejection beside the field it names", async () => {
    const user = userEvent.setup();
    updateFacilityMock.mockRejectedValue(rejection(400, "platform_fee_percent must be between 0 and 100"));
    const { onSaved } = setup();
    await user.click(screen.getByRole("button", { name: /edit facility profile/i }));
    const fee = screen.getByLabelText(/platform fee/i);
    await user.clear(fee);
    await user.type(fee, "50");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("platform_fee_percent must be between 0 and 100")).toBeInTheDocument();
    expect(screen.getByText("Editing")).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalled();
    expect(screen.queryByText("Facility profile saved.")).not.toBeInTheDocument();
  });

  it("shows a form-level alert for a rejection that names no field", async () => {
    const user = userEvent.setup();
    updateFacilityMock.mockRejectedValue(rejection(400, "No permitted facility fields supplied"));
    setup();
    await user.click(screen.getByRole("button", { name: /edit facility profile/i }));
    await user.type(screen.getByLabelText("County"), "x");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No permitted facility fields supplied");
  });

  it("disables Save and shows progress while saving", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    updateFacilityMock.mockReturnValue(new Promise<void>((resolve) => { release = resolve; }));
    setup();
    await user.click(screen.getByRole("button", { name: /edit facility profile/i }));
    await user.type(screen.getByLabelText("County"), "x");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const saving = await screen.findByRole("button", { name: /saving/i });
    expect(saving).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    release();
  });

  it("shows the hospital level only for hospitals", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /edit facility profile/i }));
    expect(screen.queryByLabelText("Hospital level")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Facility type"), "hospital");
    expect(within(screen.getByRole("form", { name: /edit facility profile/i })).getByLabelText("Hospital level")).toBeInTheDocument();
  });

  it("opens the phone numbers and hours dialog from the card", async () => {
    const user = userEvent.setup();
    const { onEditContactAndHours } = setup();
    await user.click(screen.getByRole("button", { name: /phone numbers and hours/i }));
    expect(onEditContactAndHours).toHaveBeenCalled();
  });
});
