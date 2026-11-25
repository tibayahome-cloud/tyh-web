/**
 * A conversation reads top to bottom like any chat: the oldest message first, the newest next to the box you type in,
 * each day's date above that day's first message. The messages arrive newest first (the server pages them that way).
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MessageThread, type Message } from "../MessageThread";

const message = (id: string, body: string, created_at: string, isMe = false): Message => ({
  id,
  body,
  created_at,
  isMe,
  delivery_status: "delivered"
});

// As the server sends them: newest first.
const NEWEST_FIRST = [
  message("m3", "hello how are you?", "2026-11-25T09:56:00Z", true),
  message("m2", "Good afternoon, this is a smoke test", "2026-11-24T09:55:00Z"),
  message("m1", "Earlier the same day", "2026-11-24T08:10:00Z", true)
];

const renderThread = (props: Partial<React.ComponentProps<typeof MessageThread>> = {}) =>
  render(<MessageThread title="Linds Owens" messages={NEWEST_FIRST} onSendMessage={vi.fn()} {...props} />);

const texts = () => Array.from(document.querySelectorAll("div[class*='rounded-2xl'][class*='px-4']")).map((el) => el.textContent ?? "");

describe("MessageThread order", () => {
  it("shows the oldest message first and the newest last", () => {
    renderThread();

    const body = texts().map((text) => text.replace(/\d\d:\d\d.*$/, "").trim());
    expect(body).toEqual(["Earlier the same day", "Good afternoon, this is a smoke test", "hello how are you?"]);
  });

  it("puts each day's date above that day's first message, once per day", () => {
    renderThread();

    const dates = screen.getAllByText(/^(November \d+, 2026)$/);
    expect(dates.map((d) => d.textContent)).toEqual(["November 24, 2026", "November 25, 2026"]);
    const first = screen.getByText("Earlier the same day");
    expect(dates[0].compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const last = screen.getByText("hello how are you?");
    expect(dates[1].compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps a short conversation at the bottom, beside the box you type in, not at the top", () => {
    const { container } = renderThread({ messages: [NEWEST_FIRST[0]] });

    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    expect(scroller).toHaveClass("flex", "flex-col");
    expect(scroller.firstElementChild).toHaveClass("mt-auto");
    expect(scroller.className).not.toMatch(/flex-col-reverse/);
  });

  it("offers older messages at the top of the list", () => {
    const { container } = renderThread({ hasMore: true, onLoadMore: vi.fn() });

    const button = screen.getByRole("button", { name: "Load older messages" });
    const list = container.querySelector(".mt-auto") as HTMLElement;
    expect(list.firstElementChild).toBe(button);
  });

  it("still has the message box and the send button", () => {
    renderThread();

    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
    expect(within(document.body).getByRole("button", { name: "Send message" })).toBeInTheDocument();
  });
});
