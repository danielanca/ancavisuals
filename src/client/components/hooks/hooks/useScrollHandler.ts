// hooks/useScrollHandler.js
import { useEffect } from 'react';
import ReactGA from 'react-ga'; // Make sure to import necessary libraries

const useScrollHandler = () => {
  useEffect(() => {
    const handleScroll = () => {
      const bottom = Math.ceil(window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight;
      if (bottom) {
        // ReactGA.event("User scrolled to bottom");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);
};

export default useScrollHandler;
