import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import QRMomentsPromo from "src/client/pages/CampaignLanding/QRMomentsPromo";

describe("QRMomentsPromo", () => {
  test("shows the QR Moments offer with the provided visuals and CTA", () => {
    const onCta = vi.fn();

    render(<QRMomentsPromo whatsappHref="https://wa.me/40745469907" onCta={onCta} />);

    expect(screen.getByRole("heading", { name: "QR Code Moments" })).toBeInTheDocument();
    expect(screen.getByText("Inclus în pachet")).toBeInTheDocument();
    expect(screen.queryByText(/gratuit/i)).not.toBeInTheDocument();
    expect(screen.getByAltText("Card QR Code Moments pentru eveniment")).toHaveAttribute(
      "src",
      "https://ancavisuals.b-cdn.net/resources/QR-site.jpg",
    );
    expect(screen.getByAltText("Invitați care scanează codul QR")).toHaveAttribute(
      "src",
      "https://ancavisuals.b-cdn.net/resources/QR-site2.jpg",
    );

    const cta = screen.getByRole("link", { name: /Vreau QR Code Moments/ });
    expect(cta).toHaveAttribute("href", "https://wa.me/40745469907");
    fireEvent.click(cta);
    expect(onCta).toHaveBeenCalledTimes(1);
  });
});
