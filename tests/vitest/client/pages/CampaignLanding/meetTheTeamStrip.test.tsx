import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import MeetTheTeamStrip, { FACES_PHOTO_URL } from "src/client/pages/CampaignLanding/MeetTheTeamStrip";
afterEach(cleanup);
describe("MeetTheTeamStrip", () => {
  it("shows our photo, who does what, and links to the full story", () => {
    render(<MeetTheTeamStrip />);
    expect(screen.getByRole("heading", { name: /Dani \(video\) și Estera \(foto\)/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Dani și Estera, echipa Anca Visuals" })).toHaveAttribute("src", FACES_PHOTO_URL);
    expect(screen.getByRole("link", { name: /Povestea noastră/ })).toHaveAttribute("href", "#despre-noi");
  });
});
