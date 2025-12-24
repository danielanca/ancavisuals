import { useEffect, useRef } from "react";
import {useOnScreen} from './../../../hooks/onScreen';

export const useScrollSense = (callBk: () => void) => {
  const handleScroll = () => {
    const bottom = Math.ceil(window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight;

    if (bottom) {
      callBk();
    }
  };
  useEffect(() => {
    window.addEventListener("scroll", handleScroll, {
      passive: true
    });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);
};

export const useSenseScreen = (ref: any, path: any, funcCall?: () => void) => {
  const isVisible = useOnScreen(ref);

  useEffect(() => {
    if (isVisible) {
      // console.log("User is interacting with:", path, funcCall);
      if (funcCall) funcCall();
    }
  }, [isVisible]);
};
