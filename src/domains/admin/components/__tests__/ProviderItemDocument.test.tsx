/** An administrator adding or replacing a provider's document for them. */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../../shared/libs/api", () => ({ api }));

import { ToastProvider } from "../../../../shared/components/ToastProvider";
import { ProviderItemDocument } from "../ProviderItemDocument";

const renderIt = (props: Partial<React.ComponentProps<typeof ProviderItemDocument>> = {}) => {
  const onUploaded = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <ProviderItemDocument
          applicationId="app1"
          itemId="it1"
          label="Practising licence"
          hasFile={false}
          hasExpiry={false}
          expiresOn={null}
          onUploaded={onUploaded}
          {...props}
        />
      </ToastProvider>
    </QueryClientProvider>
  );
  return { onUploaded };
};

const pdf = () => new File(["%PDF-1.4"], "licence.pdf", { type: "application/pdf" });

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset().mockResolvedValue({});
});

describe("adding a provider's document for them", () => {
  it("sends the file to the item's upload route and refreshes the page", async () => {
    const { onUploaded } = renderIt();

    await userEvent.upload(screen.getByTestId("file-it1"), pdf());

    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    const [url, body] = api.post.mock.calls[0];
    expect(url).toBe("/provider-applications/app1/items/it1/upload");
    expect((body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("offers Add when nothing is on file, and Replace and View when something is", () => {
    renderIt();
    expect(screen.getByRole("button", { name: "Add Practising licence" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View/ })).not.toBeInTheDocument();
  });

  it("offers Replace and View when a document is already on file", () => {
    renderIt({ hasFile: true });
    expect(screen.getByRole("button", { name: "Replace Practising licence" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Practising licence" })).toBeInTheDocument();
  });

  it("asks for the expiry date first when the paper has one, and sends it with the file", async () => {
    renderIt({ hasExpiry: true });

    await userEvent.click(screen.getByRole("button", { name: "Add Practising licence" }));
    expect(screen.getByText("Enter the date this document runs out, then choose the file.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Runs out on"), "2027-03-31");
    await userEvent.upload(screen.getByTestId("file-it1"), pdf());

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect((api.post.mock.calls[0][1] as FormData).get("expires_on")).toBe("2027-03-31");
  });

  it("says so when the server refuses, and does not refresh", async () => {
    api.post.mockRejectedValue(new Error("That file is larger than 10 MB. Use a smaller file, or take a photo instead."));
    const { onUploaded } = renderIt();

    await userEvent.upload(screen.getByTestId("file-it1"), pdf());

    expect(await screen.findByText("That file is larger than 10 MB. Use a smaller file, or take a photo instead.")).toBeInTheDocument();
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
