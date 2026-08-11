import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, client } = vi.hoisted(() => {
  const client = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  };

  return { create: vi.fn(() => client), client };
});

vi.mock("axios", () => ({
  default: { create }
}));

describe("api client", () => {
  beforeEach(() => {
    vi.resetModules();
    create.mockClear();
    client.interceptors.request.use.mockClear();
    client.interceptors.response.use.mockClear();
  });

  it("limits API requests so a stopped backend cannot leave the UI pending forever", async () => {
    await import("../api");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 15000
      })
    );
    expect(client.interceptors.request.use).toHaveBeenCalledOnce();
    expect(client.interceptors.response.use).toHaveBeenCalledOnce();
  });

  it("dispatches a legal consent event when the backend returns 428", async () => {
    await import("../api");
    const responseHandler = client.interceptors.response.use.mock.calls[0][1];
    const listener = vi.fn();
    window.addEventListener("tiba:legal-consent-required", listener);

    await expect(
      responseHandler({
        response: {
          status: 428,
          data: {
            error: {
              message: "LEGAL_CONSENT_REQUIRED"
            }
          }
        },
        config: {}
      })
    ).rejects.toBeTruthy();

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("tiba:legal-consent-required", listener);
  });
});
