import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ResetPrintModal, { isResetConfirmed } from "src/client/pages/MediaDownload/ResetPrintModal";

test("the phrase works with or without diacritics, any case, extra spaces; anything else doesn't", () => {
  expect(isResetConfirmed("resetez toată selecția")).toBe(true);
  expect(isResetConfirmed("resetez toata selectia")).toBe(true);
  expect(isResetConfirmed("  RESETEZ   TOATĂ  SELECȚIA ")).toBe(true);
  expect(isResetConfirmed("resetez toată selecţia")).toBe(true); // cedilla ţ (older keyboards)
  expect(isResetConfirmed("resetez")).toBe(false);
  expect(isResetConfirmed("da")).toBe(false);
});

test("reset runs only after the phrase is typed; Anulează closes without resetting", () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<ResetPrintModal count={100} onCancel={onCancel} onConfirm={onConfirm} />);
  expect(screen.getByRole("alertdialog")).toHaveTextContent("100");
  const confirm = screen.getByRole("button", { name: "Resetează tot" });
  expect(confirm).toBeDisabled();

  const input = screen.getByLabelText(/Ca să confirmi/);
  fireEvent.change(input, { target: { value: "resetez toata" } });
  fireEvent.submit(input.closest("form")!);
  expect(onConfirm).not.toHaveBeenCalled();

  fireEvent.change(input, { target: { value: "Resetez toata selectia" } });
  expect(confirm).toBeEnabled();
  fireEvent.click(confirm);
  expect(onConfirm).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "Anulează" }));
  expect(onCancel).toHaveBeenCalledOnce();
});
