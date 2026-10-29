/*
 * Purpose: the gallery's full-screen viewer — "01 / 03" counter, the arrows under the photo
 * step through the photos (first/last disable theirs), the swipe hint only when asked, on phones.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import PortfolioLightbox from "src/client/pages/Portfolio/PortfolioLightbox";

const slides = ["a", "b", "c"].map((name) => ({ src: `https://cdn.test/${name}.jpg` }));
const counter = () => document.querySelector(".ppl-count strong")?.textContent;

describe("portfolio lightbox", () => {
  test("counter and arrows step through the photos", async () => {
    render(<PortfolioLightbox open index={0} close={() => undefined} slides={slides} isMobile swipeHint />);
    expect(counter()).toBe("01");
    expect(document.querySelector(".ppl-count")?.textContent).toContain("03");
    const prev = document.querySelector<HTMLButtonElement>(".ppl-step[aria-label='Poza anterioară']")!;
    const next = document.querySelector<HTMLButtonElement>(".ppl-step[aria-label='Poza următoare']")!;
    expect(prev.disabled).toBe(true);

    await act(async () => { fireEvent.click(next); });
    await act(async () => { fireEvent.click(next); });
    expect(counter()).toBe("03");
    expect(next.disabled).toBe(true);
    expect(screen.getByText("Glisează pentru următoarea")).toBeInTheDocument();
  });

  test("no swipe hint on a computer or after the first photo", () => {
    const { unmount } = render(<PortfolioLightbox open index={0} close={() => undefined} slides={slides} isMobile={false} swipeHint />);
    expect(screen.queryByText("Glisează pentru următoarea")).toBeNull();
    unmount();
    render(<PortfolioLightbox open index={0} close={() => undefined} slides={slides} isMobile swipeHint={false} />);
    expect(screen.queryByText("Glisează pentru următoarea")).toBeNull();
  });
});
