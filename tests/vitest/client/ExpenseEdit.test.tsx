import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AddExpenseModal } from "src/client/features/admin/components/Financial/FinancialPage";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const receipt = { url: "https://cdn.example/receipt.pdf", name: "receipt.pdf", hash: "receipt" };
const expense = { id: "e1", date: "2026-10-09T00:00:00.000Z", category: "combustibil", description: "Drum", supplier: "Acme", amount: 165, currency: "RON", deductibility: 24.24, deductibleAmount: 40, invoiceNumber: "123", factura: null, chitanta: receipt };

test("adds an invoice to the existing expense preserving its receipt and fixed deductible amount", async () => {
  const invoice = { url: "https://cdn.example/invoice.pdf", name: "invoice.pdf", hash: "invoice" };
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => invoice }).mockResolvedValueOnce({ ok: true, json: async () => ({ id: "e1" }) });
  vi.stubGlobal("fetch", fetchMock);
  const onAdded = vi.fn();
  const onDuplicateFound = vi.fn();
  render(<AddExpenseModal expense={expense} existingExpenses={[expense]} accessToken="test" onClose={vi.fn()} onAdded={onAdded} onDuplicateFound={onDuplicateFound} />);
  expect(screen.getByRole("link", { name: /receipt.pdf/ })).toHaveAttribute("href", receipt.url);
  fireEvent.change(screen.getByLabelText("Factură"), { target: { files: [new File(["invoice"], "invoice.pdf", { type: "application/pdf" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Salvează" }));
  await waitFor(() => expect(onAdded).toHaveBeenCalled());
  expect(fetchMock.mock.calls[1][0]).toBe("/api/admin/expenses/e1");
  expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ factura: invoice, chitanta: receipt, amount: 165, deductibleAmount: 40 });
  expect(onDuplicateFound).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls.some(([url]) => url.includes("scan-receipt"))).toBe(false);
});

test("failed saving retains the form, receipt and selected invoice", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ url: "https://cdn.example/invoice.pdf", name: "invoice.pdf" }) }).mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Salvare eșuată" }) });
  vi.stubGlobal("fetch", fetchMock);
  const onAdded = vi.fn(), onClose = vi.fn();
  render(<AddExpenseModal expense={expense} existingExpenses={[expense]} accessToken="test" onClose={onClose} onAdded={onAdded} onDuplicateFound={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Factură"), { target: { files: [new File(["invoice"], "invoice.pdf")] } });
  fireEvent.click(screen.getByRole("button", { name: "Salvează" }));
  expect(await screen.findByText("Salvare eșuată")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "invoice.pdf" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /receipt.pdf/ })).toBeInTheDocument();
  expect(onAdded).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});


test("preserves USD conversion and the stored deductible amount when only attaching documents", async () => {
  const usdExpense = { ...expense, amount: 450, originalAmount: 100, originalCurrency: "USD", exchangeRate: 4.5, deductibleAmount: 225, deductibility: 50 };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "e1" }) });
  vi.stubGlobal("fetch", fetchMock);
  const onAdded = vi.fn();
  render(<AddExpenseModal expense={usdExpense} existingExpenses={[usdExpense]} accessToken="test" onClose={vi.fn()} onAdded={onAdded} onDuplicateFound={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Salvează" }));
  await waitFor(() => expect(onAdded).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ amount: 450, currency: "RON", originalAmount: 100, originalCurrency: "USD", exchangeRate: 4.5, deductibleAmount: 225 });
});

test("a probable duplicate asks for confirmation, then saves with the confirmation flag", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: "new" }) });
  vi.stubGlobal("fetch", fetchMock);
  const onAdded = vi.fn();
  const onDuplicateFound = vi.fn();
  const existing = { ...expense, id: "old", invoiceNumber: null, date: "2026-10-09T00:00:00.000Z" };
  const { container } = render(<AddExpenseModal existingExpenses={[existing]} accessToken="test" onClose={vi.fn()} onAdded={onAdded} onDuplicateFound={onDuplicateFound} />);
  fireEvent.change(screen.getByPlaceholderText("ex: Petrom, Dedeman..."), { target: { value: "ACME S.R.L." } });
  fireEvent.change(container.querySelector('input[type="number"][step="0.01"]')!, { target: { value: "165" } });
  fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2026-10-10" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvează" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("același furnizor");
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /salvează oricum/ }));
  await waitFor(() => expect(onAdded).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ confirmPossibleDuplicate: true, supplier: "ACME S.R.L." });
  expect(onDuplicateFound).not.toHaveBeenCalled();
});
