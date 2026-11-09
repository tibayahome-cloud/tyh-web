import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppBottomNav } from "../AppBottomNav";

describe("AppBottomNav", () => {
  it("shows a tab's short name when it has one, so a long label is not cut off on a phone", () => {
    render(
      <MemoryRouter>
        <AppBottomNav
          items={[
            { label: "Home", to: "/app/home", icon: <span /> },
            { label: "Telemedicine", shortLabel: "Video", to: "/app/telemedicine", icon: <span /> }
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Video" })).toHaveAttribute("href", "/app/telemedicine");
    expect(screen.queryByText("Telemedicine")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });
});
