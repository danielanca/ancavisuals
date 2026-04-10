/*
 * Purpose: defines shared booking validation rules, currently the phone regex
 * used by the contact and booking flows.
 */
// src/booking/utils/validators.ts
export const PHONE_RE = /^[0-9+\s()-]{8,20}$/;
