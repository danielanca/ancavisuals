import { useEffect } from "react";

export const useOutsideClicker = (
  ref: React.MutableRefObject<HTMLDivElement> | React.MutableRefObject<null>,
  callback: () => void
) => {
  const handleClick = (e: MouseEvent) => {
    if (ref.current && ref.current === e.target) {
      callback();
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  });
};
