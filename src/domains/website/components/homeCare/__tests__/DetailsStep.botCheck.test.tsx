/**
 * The bot check works once per token. After a code has been asked for (or refused) the next ask needs a fresh check, and the
 * check must still be on the page to give one: before this, the widget was removed after the first code and a resend, or any
 * retry after a refusal, could never succeed.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ sendHomeCareCode: vi.fn(), createHomeCareRequest: vi.fn() }));
vi.mock("../../../../../shared/libs/homeCarePublic", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../shared/libs/homeCarePublic")>()),
  ...api
}));

import { DetailsStep } from "../DetailsStep";

type Options = { sitekey: string; callback: (token: string) => void; "expired-callback": () => void };
const widget = { options: null as null | Options, render: vi.fn(), reset: vi.fn(), remove: vi.fn() };

const renderStep = () =>
  render(
    <MemoryRouter>
      <DetailsStep
        serviceId="svc-1"
        facilityId="fac-1"
        place={{ lat: -1.29, lng: 36.82, address: "Kilimani, Nairobi", landmark: "" }}
        scheduledAt={null}
        onDone={vi.fn()}
      />
    </MemoryRouter>
  );

const fillIn = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/Full name/), "Amina Wanjiru");
  await user.type(screen.getByLabelText(/Phone number/), "0712345678");
  await user.click(screen.getByRole("checkbox"));
};

beforeEach(() => {
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "site-key");
  api.sendHomeCareCode.mockReset();
  widget.reset.mockReset();
  widget.remove.mockReset();
  widget.render.mockReset();
  widget.render.mockImplementation((_el: HTMLElement, options: Options) => {
    widget.options = options;
    return "widget-1";
  });
  (window as unknown as { turnstile: unknown }).turnstile = widget;
});
afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as unknown as { turnstile?: unknown }).turnstile;
});

describe("the bot check on the details step", () => {
  it("does not let a code be asked for until the check has given a token, and sends the token with the request", async () => {
    api.sendHomeCareCode.mockResolvedValue({ status: "sent", expires_in: 600, resend_after: 0 });
    const user = userEvent.setup();
    renderStep();
    await fillIn(user);
    await waitFor(() => expect(widget.render).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: "Text me a code" })).toBeDisabled();

    widget.options!.callback("token-1");
    await waitFor(() => expect(screen.getByRole("button", { name: "Text me a code" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Text me a code" }));

    expect(api.sendHomeCareCode).toHaveBeenCalledWith(expect.objectContaining({ bot_token: "token-1" }));
  });

  it("asks the check for a new token after each attempt and keeps the widget on the page for the next one", async () => {
    api.sendHomeCareCode.mockResolvedValue({ status: "sent", expires_in: 600, resend_after: 0 });
    const user = userEvent.setup();
    renderStep();
    await fillIn(user);
    await waitFor(() => expect(widget.render).toHaveBeenCalled());
    widget.options!.callback("token-1");
    await user.click(await screen.findByRole("button", { name: "Text me a code" }));

    await screen.findByLabelText(/6-digit code/);
    expect(widget.reset).toHaveBeenCalledWith("widget-1");
    expect(widget.remove).not.toHaveBeenCalled(); // the widget is still there to give the next token
    const resend = screen.getByRole("button", { name: /Send a new code/ });
    expect(resend).toBeDisabled(); // no token yet

    widget.options!.callback("token-2");
    await waitFor(() => expect(screen.getByRole("button", { name: "Send a new code" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Send a new code" }));

    expect(api.sendHomeCareCode).toHaveBeenLastCalledWith(expect.objectContaining({ bot_token: "token-2" }));
  });

  it("gives a fresh check after a refused attempt too, so the visitor can try again", async () => {
    api.sendHomeCareCode.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 429, data: { error: { message: "We just sent a code.", details: { code: "wait", retry_after: 0 } } } }
    });
    const user = userEvent.setup();
    renderStep();
    await fillIn(user);
    await waitFor(() => expect(widget.render).toHaveBeenCalled());
    widget.options!.callback("token-1");
    await user.click(await screen.findByRole("button", { name: "Text me a code" }));

    await screen.findByRole("alert");
    expect(widget.reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Text me a code" })).toBeDisabled();
  });

  it("is not shown, and does not hold the button back, when no site key is set", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    const user = userEvent.setup();
    renderStep();
    await fillIn(user);

    expect(widget.render).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Text me a code" })).toBeEnabled();
  });

  it("offers the phone number as well as sign-in when the number already has an account", async () => {
    api.sendHomeCareCode.mockResolvedValue({ status: "sign_in", expires_in: 600, resend_after: 0 });
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    const user = userEvent.setup();
    renderStep();
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Text me a code" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/already has an account/);
    expect(alert.querySelector('a[href="/login"]')).not.toBeNull();
    expect(alert.querySelector('a[href^="tel:"]')).not.toBeNull();
  });
});
