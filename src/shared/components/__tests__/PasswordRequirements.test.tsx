import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PasswordRequirements } from "../PasswordRequirements";

const statusOf = (label: RegExp) => {
  const item = screen.getByText(label).closest("li") as HTMLElement;
  return within(item).getByText(/: (met|not met|not met yet)$/).textContent;
};

describe("PasswordRequirements", () => {
  it("lists every requirement before anything is typed, without marking any as failed", () => {
    render(<PasswordRequirements id="reqs" password="" />);

    expect(screen.getByText("Your password needs")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    for (const label of [/At least 10 characters/, /uppercase/, /lowercase/, /One number/, /special character/]) {
      expect(statusOf(label)).toBe(": not met yet");
    }
  });

  it("updates each rule live as the password changes", () => {
    const { rerender } = render(<PasswordRequirements id="reqs" password="abc" />);
    expect(statusOf(/lowercase/)).toBe(": met");
    expect(statusOf(/uppercase/)).toBe(": not met");
    expect(statusOf(/At least 10/)).toBe(": not met");

    rerender(<PasswordRequirements id="reqs" password="Abcdefghi1!" />);
    for (const label of [/At least 10 characters/, /uppercase/, /lowercase/, /One number/, /special character/]) {
      expect(statusOf(label)).toBe(": met");
    }
  });

  it("marks unmet rules as failed after a submit attempt even if nothing was typed", () => {
    render(<PasswordRequirements id="reqs" password="" showFailures />);
    expect(statusOf(/uppercase/)).toBe(": not met");
  });

  it("does not rely on colour: every row carries its state as text and its icon is hidden", () => {
    const { container } = render(<PasswordRequirements id="reqs" password="Abc" />);
    container.querySelectorAll("svg").forEach((icon) => expect(icon).toHaveAttribute("aria-hidden", "true"));
    expect(container.querySelectorAll("li .sr-only")).toHaveLength(5);
  });

  it("exposes the list as a description target and announces when the password is acceptable", () => {
    const { container } = render(<PasswordRequirements id="pw-reqs" password="@Qwerty123" />);

    expect(container.querySelector("#pw-reqs")).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Password meets every requirement.");
  });

  it("stays silent while the password is not yet acceptable", () => {
    render(<PasswordRequirements id="reqs" password="short" />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  describe("with a confirmation", () => {
    it("adds a match row that is neutral until the confirmation is typed", () => {
      render(<PasswordRequirements id="reqs" password="@Qwerty123" confirmPassword="" />);
      expect(screen.getAllByRole("listitem")).toHaveLength(6);
      expect(statusOf(/Both passwords match/)).toBe(": not met yet");
    });

    it("shows a mismatch as it is typed, and a match once they agree", () => {
      const { rerender } = render(<PasswordRequirements id="reqs" password="@Qwerty123" confirmPassword="@Qwerty" />);
      expect(statusOf(/Both passwords match/)).toBe(": not met");

      rerender(<PasswordRequirements id="reqs" password="@Qwerty123" confirmPassword="@Qwerty123" />);
      expect(statusOf(/Both passwords match/)).toBe(": met");
      expect(screen.getByRole("status")).toHaveTextContent("Passwords match.");
    });

    it("does not call two empty fields a match", () => {
      render(<PasswordRequirements id="reqs" password="" confirmPassword="" showFailures />);
      expect(statusOf(/Both passwords match/)).toBe(": not met");
    });
  });
});
