import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import ReferralTrafficPanel from "src/client/features/admin/components/ReferralTrafficPanel";

test("searches sources outside a top-five list, opens their pages and updates the period", () => {
  const visits = Array.from({ length: 7 }, (_, index) => ({ id: String(index), sessionId: String(index), visitorId: String(index), page: index === 6 ? "/contact" : "/", referrer: `https://${index === 6 ? "sibiunews.net" : `site${index}.ro`}/`, timestamp: "2026-10-08T10:00:00Z" }));
  const { rerender } = render(<ReferralTrafficPanel visits={visits} cutoff={new Date("2026-10-01")} periodLabel="7 zile" />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "sibiunews" } });
  expect(screen.queryByRole("button", { name: "site0.ro" })).not.toBeInTheDocument();
  const source = screen.getByRole("button", { name: "sibiunews.net" });
  expect(within(source.closest("tr")!).getAllByText("1")).toHaveLength(3);
  fireEvent.click(source);
  expect(screen.getByText("/contact")).toBeInTheDocument();
  rerender(<ReferralTrafficPanel visits={visits} cutoff={new Date("2026-10-09")} periodLabel="Azi" />);
  expect(screen.getByText(/Niciun trafic identificat/)).toBeInTheDocument();
  expect(screen.queryByText("/contact")).not.toBeInTheDocument();
});
