import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PasswordRequirements } from "../PasswordRequirements";

const LENGTH = /Password must be at least 10 characters/;
const NUMBER = /Password must contain 1 number/;
const SPECIAL = /Password must contain 1 special character/;
const CASE = /Password must contain 1 upper case and 1 lower case letter/;
const MATCH = /Passwords must match/;

const stateOf = (label: RegExp) => {
  const item = screen.getByText(label).closest("li") as HTMLElement;
  return within(item).getByText(/: (met|not met)$/).textContent;
};

describe("PasswordRequirements", () => {
  it("lists the requirements as short sentences before anything is typed", () => {
    render(<PasswordRequirements id="reqs" password="" />);

    expect(screen.getByRole("list", { name: "Requirements for your password" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    for (const label of [LENGTH, NUMBER, SPECIAL, CASE]) {
      expect(stateOf(label)).toBe(": not met");
    }
  });

  it("updates each line live as the password changes", () => {
    const { rerender } = render(<PasswordRequirements id="reqs" password="abcdefghij" />);
    expect(stateOf(LENGTH)).toBe(": met");
    expect(stateOf(NUMBER)).toBe(": not met");
    expect(stateOf(SPECIAL)).toBe(": not met");
    expect(stateOf(CASE)).toBe(": not met");

    rerender(<PasswordRequirements id="reqs" password="Abcdefghi1!" />);
    for (const label of [LENGTH, NUMBER, SPECIAL, CASE]) {
      expect(stateOf(label)).toBe(": met");
    }
  });

  it("needs both an upper case and a lower case letter to tick the case line", () => {
    const { rerender } = render(<PasswordRequirements id="reqs" password="ABCDEFGHIJ" />);
    expect(stateOf(CASE)).toBe(": not met");

    rerender(<PasswordRequirements id="reqs" password="abcdefghij" />);
    expect(stateOf(CASE)).toBe(": not met");

    rerender(<PasswordRequirements id="reqs" password="Abcdefghij" />);
    expect(stateOf(CASE)).toBe(": met");
  });

  it("shows a green tick when met and a grey cross when not, without relying on colour alone", () => {
    const { container } = render(<PasswordRequirements id="reqs" password="Abc1" />);

    const badges = Array.from(container.querySelectorAll("li > span[aria-hidden='true']"));
    expect(badges).toHaveLength(4);
    expect(badges.filter((badge) => badge.className.includes("bg-emerald-600"))).toHaveLength(2);
    expect(badges.filter((badge) => badge.className.includes("bg-slate-400"))).toHaveLength(2);
    expect(container.querySelectorAll("li .sr-only")).toHaveLength(4);
  });

  it("does not turn red for an unmet rule, even after typing", () => {
    const { container } = render(<PasswordRequirements id="reqs" password="a" />);
    expect(container.innerHTML).not.toMatch(/red-/);
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
    it("adds a match line that is unmet until the two agree", () => {
      const { rerender } = render(<PasswordRequirements id="reqs" password="@Qwerty123" confirmPassword="" />);
      expect(screen.getAllByRole("listitem")).toHaveLength(5);
      expect(stateOf(MATCH)).toBe(": not met");

      rerender(<PasswordRequirements id="reqs" password="@Qwerty123" confirmPassword="@Qwerty" />);
      expect(stateOf(MATCH)).toBe(": not met");

      rerender(<PasswordRequirements id="reqs" password="@Qwerty123" confirmPassword="@Qwerty123" />);
      expect(stateOf(MATCH)).toBe(": met");
      expect(screen.getByRole("status")).toHaveTextContent("Passwords match.");
    });

    it("does not call two empty fields a match", () => {
      render(<PasswordRequirements id="reqs" password="" confirmPassword="" />);
      expect(stateOf(MATCH)).toBe(": not met");
    });
  });
});
