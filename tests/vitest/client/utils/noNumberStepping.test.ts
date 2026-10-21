/*
 * Purpose: number fields are typed only — ↑/↓ and the mouse wheel don't step their value.
 */
import { afterEach, describe, expect, test } from "vitest";
import { installNoNumberStepping } from "src/client/utils/noNumberStepping";

describe("no number stepping", () => {
  let uninstall = () => {};
  afterEach(() => { uninstall(); document.body.innerHTML = ""; });

  test("arrow keys are blocked on number fields only", () => {
    uninstall = installNoNumberStepping();
    document.body.innerHTML = '<input type="number" id="n"><input type="text" id="t">';
    const press = (id: string) => {
      const event = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true });
      document.getElementById(id)!.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(press("n")).toBe(true);
    expect(press("t")).toBe(false);
  });

  test("the wheel leaves a focused number field instead of changing it", () => {
    uninstall = installNoNumberStepping();
    document.body.innerHTML = '<input type="number" id="n">';
    const input = document.getElementById("n") as HTMLInputElement;
    input.focus();
    input.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    expect(document.activeElement).not.toBe(input);
  });
});
