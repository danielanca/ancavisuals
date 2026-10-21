// Number fields are typed, never stepped (owner's choice, whole site): the arrows are hidden in
// index.css, and here the mouse wheel and the ↑/↓ keys no longer change a focused number field.
const isNumberInput = (target: EventTarget | null): target is HTMLInputElement =>
  target instanceof HTMLInputElement && target.type === "number";

export function installNoNumberStepping(): () => void {
  const onWheel = (event: WheelEvent) => {
    // Blurring lets the page scroll as usual instead of changing the value.
    if (isNumberInput(event.target) && document.activeElement === event.target) event.target.blur();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (isNumberInput(event.target) && (event.key === "ArrowUp" || event.key === "ArrowDown")) event.preventDefault();
  };
  document.addEventListener("wheel", onWheel, { passive: true });
  document.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("wheel", onWheel);
    document.removeEventListener("keydown", onKeyDown);
  };
}
