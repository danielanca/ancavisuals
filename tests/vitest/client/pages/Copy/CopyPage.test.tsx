/*
 * Purpose: /copiaza — opened from the copy icons in our emails; copies the tapped value right away
 * and lists every value with its own "Copiază" button.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import CopyPage from "src/client/pages/Copy/CopyPage";

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText } });
  window.location.hash = "#Beneficiar=Daniel+Anca&IBAN=RO49AAAA1B31007593840000&Descriere=12.09.2026+-+Nunt%C4%83&c=IBAN";
});

afterEach(() => {
  writeText.mockClear();
  window.location.hash = "";
});

test("copies the tapped field on open and lists every field", async () => {
  render(<CopyPage />);
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("RO49AAAA1B31007593840000"));
  expect(await screen.findByText("IBAN a fost copiat")).toBeTruthy();
  expect(screen.getByText("Daniel Anca")).toBeTruthy();
  expect(screen.getByText("12.09.2026 - Nuntă")).toBeTruthy();
});

test("each button copies its own value", async () => {
  render(<CopyPage />);
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getAllByRole("button", { name: "Copiază" })[1]);
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("12.09.2026 - Nuntă"));
});
