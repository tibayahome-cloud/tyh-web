import { AxiosError } from "axios";
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

vi.mock("axios", async (importOriginal) => ({
  ...(await importOriginal<typeof import("axios")>()),
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
  describe("error messages", () => {
    const failWith = async (status: number | null, body?: unknown, code = "ERR_BAD_REQUEST") => {
      await import("../api");
      const handler = client.interceptors.response.use.mock.calls[0][1];
      const error = new AxiosError(
        status ? `Request failed with status code ${status}` : "Network Error",
        code,
        { url: "/x", headers: {} } as never,
        undefined,
        status ? ({ status, statusText: "", headers: {}, config: {}, data: body } as never) : undefined
      );
      await expect(handler(error)).rejects.toBe(error);
      return error as AxiosError & { rawMessage?: string };
    };

    it("shows the API's explanation instead of 'Request failed with status code 400'", async () => {
      const error = await failWith(400, { error: { message: "Provider is not configured for this service" } });
      expect(error.message).toBe("Provider is not configured for this service");
      expect(error.rawMessage).toBe("Request failed with status code 400");
    });

    it("explains a bare 400, a missing page, a permission problem and a server fault", async () => {
      expect((await failWith(400, {})).message).toMatch(/not accepted/);
      expect((await failWith(404, {})).message).toMatch(/could not find/);
      expect((await failWith(403, {})).message).toMatch(/permission/);
      expect((await failWith(500, "<html>oops</html>")).message).toMatch(/our side/);
    });

    it("says when the server cannot be reached or is too slow", async () => {
      expect((await failWith(null)).message).toMatch(/could not reach the server/);
      expect((await failWith(null, undefined, "ECONNABORTED")).message).toMatch(/too long/);
    });
  });
});
