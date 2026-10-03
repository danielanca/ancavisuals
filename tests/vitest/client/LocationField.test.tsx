import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import LocationField from "src/client/pages/Contact/LocationField";

const fetchSuggestions = vi.fn();
const suggestion = { placePrediction: {
  text: { text: "Restaurant Cluj" },
  toPlace: () => ({ id: "venue", displayName: { text: "Restaurant Cluj" } }),
} };
function setup() {
  vi.stubGlobal("google", { maps: { importLibrary: async () => ({
    AutocompleteSessionToken: class {},
    AutocompleteSuggestion: { fetchAutocompleteSuggestions: fetchSuggestions },
  }) } });
  const onSelect = vi.fn();
  render(<LocationField apiKey="test" value="Cluj" onChange={vi.fn()} onSelect={onSelect} />);
  return onSelect;
}
afterEach(() => { vi.unstubAllGlobals(); fetchSuggestions.mockReset(); });

test("a late location response does not reopen the menu after leaving the field", async () => {
  let resolve!: (value: { suggestions: typeof suggestion[] }) => void;
  fetchSuggestions.mockImplementation(() => new Promise(r => { resolve = r; }));
  setup();
  const input = screen.getByRole("textbox");
  fireEvent.focus(input);
  await waitFor(() => expect(fetchSuggestions).toHaveBeenCalled());
  fireEvent.blur(input);
  await act(async () => { resolve({ suggestions: [suggestion] }); });
  expect(screen.queryByText("Restaurant Cluj")).not.toBeInTheDocument();
});

test("touching a suggestion prevents focus transfer and still selects the location", async () => {
  fetchSuggestions.mockResolvedValue({ suggestions: [suggestion] });
  const onSelect = setup();
  const option = await screen.findByText("Restaurant Cluj");
  expect(fireEvent.pointerDown(option, { pointerType: "touch" })).toBe(false);
  fireEvent.click(option);
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "venue" })));
  expect(screen.queryByText("Restaurant Cluj")).not.toBeInTheDocument();
});
