/**
 * The gate in front of the whole app is for the first load: a stored session is restored before any page decides the
 * person is signed out. It must not come back later. Signing in refreshes the profile in the background, which sets
 * isBootstrapping again, and swapping the app for a spinner at that moment unmounted every page. A booking made without
 * an account lost its place the instant the account existed.
 */

import { useEffect, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

type AuthState = {
  accessToken: string | null;
  hasRefreshToken: boolean;
  isBootstrapping: boolean;
  refresh: () => Promise<unknown>;
};

const { auth } = vi.hoisted(() => ({ auth: { value: {} as AuthState } }));

vi.mock("../../shared/hooks/useAuth", () => ({ useAuth: () => auth.value }));

import { RefreshGate } from "../RefreshGate";

let mounts = 0;

/** Stands for any page with something half done on it. */
const Page = () => {
  const [draft, setDraft] = useState("");
  useEffect(() => {
    mounts += 1;
  }, []);
  return <input aria-label="draft" value={draft} onChange={(event) => setDraft(event.target.value)} />;
};

const renderGate = () =>
  render(
    <RefreshGate>
      <Page />
    </RefreshGate>
  );

beforeEach(() => {
  mounts = 0;
  auth.value = { accessToken: null, hasRefreshToken: false, isBootstrapping: false, refresh: vi.fn().mockResolvedValue(null) };
});

describe("the first load", () => {
  it("lets someone with no stored session straight through", async () => {
    renderGate();

    expect(await screen.findByLabelText("draft")).toBeInTheDocument();
  });

  it("holds the app back until a stored session has been restored", async () => {
    let finish: (value: unknown) => void = () => undefined;
    auth.value = {
      ...auth.value,
      hasRefreshToken: true,
      refresh: vi.fn().mockReturnValue(new Promise((resolve) => (finish = resolve)))
    };
    renderGate();

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByLabelText("draft")).not.toBeInTheDocument();

    await act(async () => finish(null));

    expect(await screen.findByLabelText("draft")).toBeInTheDocument();
  });

  it("waits for the profile of a signed-in person, then shows the app", async () => {
    auth.value = { ...auth.value, accessToken: "token", isBootstrapping: true };
    const view = renderGate();

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByLabelText("draft")).not.toBeInTheDocument();

    auth.value = { ...auth.value, isBootstrapping: false };
    view.rerender(
      <RefreshGate>
        <Page />
      </RefreshGate>
    );

    expect(await screen.findByLabelText("draft")).toBeInTheDocument();
  });
});

describe("after the app is showing", () => {
  it("stays mounted, with its state, when the profile is refreshed in the background", async () => {
    const user = userEvent.setup();
    const view = renderGate();
    await user.type(await screen.findByLabelText("draft"), "half done");

    // What signing in does: the token arrives and the profile is fetched, setting isBootstrapping.
    auth.value = { ...auth.value, accessToken: "token", isBootstrapping: true };
    view.rerender(
      <RefreshGate>
        <Page />
      </RefreshGate>
    );

    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    expect(screen.getByLabelText("draft")).toHaveValue("half done");
    expect(mounts).toBe(1);

    auth.value = { ...auth.value, isBootstrapping: false };
    view.rerender(
      <RefreshGate>
        <Page />
      </RefreshGate>
    );

    expect(screen.getByLabelText("draft")).toHaveValue("half done");
    expect(mounts).toBe(1);
  });
});
