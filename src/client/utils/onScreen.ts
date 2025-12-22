import React, { useEffect, useState } from "react";
import { v4 as uuid } from "uuid";

const generateUserID = () => {
  return "BRWD-" + uuid().slice(0, 8);
};
export const getUserBrowser = () => {
  return navigator.userAgent;
};
export function useOnScreen(ref: React.MutableRefObject<HTMLDivElement>) {
  const [isIntersecting, setIntersecting] = useState(false);
  const observer = new IntersectionObserver(([entry]) => setIntersecting(entry.isIntersecting));

  useEffect(() => {
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  return isIntersecting;
}

export function useAttachUserID() {
  let userID = localStorage.getItem("uuidA");
  if (!userID) {
    userID = generateUserID();
    localStorage.setItem("uuidA", JSON.stringify(userID));
  } else userID = localStorage.getItem("uuidA");

  return userID;
}

export const useOutsideClicker = (
  ref: React.MutableRefObject<null> | React.MutableRefObject<HTMLDivElement>,
  callback: () => void,
) => {
  const handleClick = (e: MouseEvent) => {
    if (ref != null) {
      if (ref.current && ref.current === e.target) {
        callback();
      }
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  });
};
