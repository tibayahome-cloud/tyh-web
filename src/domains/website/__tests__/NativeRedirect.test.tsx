/** The Android app opens straight on the right screen for whoever is signed in. */

import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { native, auth } = vi.hoisted(() => ({
  native: { value: true },
  auth: { value: { isAuthenticated: false, roles: [] as string[] } }
}));

vi.mock("../../../shared/libs/capacitor", () => ({ isNativePlatform: () => native.value }));
vi.mock("../../../shared/hooks/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("../pages/Home", () => ({ Home: () => <p>website home</p> }));
vi.mock("../components/WebsiteLayout", () => ({ WebsiteLayout: () => null }));

import { NativeRedirect } from "../routes";

const renderAtRoot = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<NativeRedirect />} />
        <Route path="/login" element={<p>sign-in page</p>} />
        <Route path="/app/home" element={<p>client home</p>} />
        <Route path="/pro/home" element={<p>provider home</p>} />
      </Routes>
      </Suspense>
    </MemoryRouter>
  );

describe("NativeRedirect", () => {
  beforeEach(() => {
    native.value = true;
    auth.value = { isAuthenticated: false, roles: [] };
  });

  it("opens the sign-in page for someone signed out", () => {
    renderAtRoot();
    expect(screen.getByText("sign-in page")).toBeInTheDocument();
  });

  it("opens Home for a signed-in client, without going through sign-in", () => {
    auth.value = { isAuthenticated: true, roles: ["client"] };
    renderAtRoot();
    expect(screen.getByText("client home")).toBeInTheDocument();
  });

  it("opens the provider's Home for a provider", () => {
    auth.value = { isAuthenticated: true, roles: ["provider"] };
    renderAtRoot();
    expect(screen.getByText("provider home")).toBeInTheDocument();
  });

  it("sends an administrator to sign in, where they are pointed to their own portal", () => {
    auth.value = { isAuthenticated: true, roles: ["admin.super"] };
    renderAtRoot();
    expect(screen.getByText("sign-in page")).toBeInTheDocument();
  });

  it("shows the website's front page in a browser", async () => {
    native.value = false;
    renderAtRoot();
    expect(await screen.findByText("website home")).toBeInTheDocument();
  });
});
