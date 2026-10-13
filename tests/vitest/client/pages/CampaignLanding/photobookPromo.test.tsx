import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import PhotobookPromo from "src/client/pages/CampaignLanding/PhotobookPromo";

describe("PhotobookPromo", () => {
  test("presents the photobook and box with a WhatsApp CTA", () => {
    render(<PhotobookPromo />);

    expect(screen.getByRole("heading", { name: "Fotocartea sau cutia voastră" })).toBeInTheDocument();
    expect(screen.getByAltText("Fotocarte cu fotografiile evenimentului")).toHaveAttribute("src", "https://ancavisuals.b-cdn.net/resources/fotocarte.jpg");
    expect(screen.getByAltText("Cutie pentru păstrarea fotocărții și amintirilor")).toHaveAttribute("src", "https://ancavisuals.b-cdn.net/resources/cutie.jpg");

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
