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
});
