// top-level constants, alongside imports
const IS_PROD = import.meta.env.PROD;
const API_BASE = ""; // same-origin in prod & dev
const BOOKING_TO = import.meta.env.VITE_BOOKING_EMAIL ?? "you@example.com";
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY; // for autocomplete (optional)
