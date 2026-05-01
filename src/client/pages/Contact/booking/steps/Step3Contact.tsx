// src/booking/steps/Step3Contact.tsx
import React from "react";
import type { Errors } from "../types";

interface Step3ContactProps {
  fullName: string;
  setFullName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  errors: Errors;
  goBack: () => void;
  saveConsent: boolean;
  setSaveConsent: (v: boolean) => void;
  onSubmitContact: () => void; // <-- callback din BookingWizard
}

const Step3Contact: React.FC<Step3ContactProps> = ({
  fullName,
  setFullName,
  phone,
  setPhone,
  errors,
  goBack,
  saveConsent,
  setSaveConsent,
  onSubmitContact,
}) => {
  return (
    <>
      <h3>3) Detalii de contact</h3>
      <form
        autoComplete="on"
        onSubmit={e => {
          e.preventDefault();
          onSubmitContact(); // delegate logic to BookingWizard
        }}
        className="booking-form"
      >
        <label htmlFor="contact-name" className="sr-only">
          Numele tău
        </label>
        <input
          id="contact-name"
          type="text"
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Numele tău"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          inputMode="text"
        />

        <label htmlFor="contact-phone" className="sr-only">
          Numărul tău de telefon
        </label>
        <input
          id="contact-phone"
          type="tel"
          name="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="Numărul tău de telefon"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />

        {/* Checkbox: consent to save contact details */}
        <label className="consent-label">
          <input type="checkbox" checked={saveConsent} onChange={e => setSaveConsent(e.target.checked)} />
          <span>
            Sunt de acord ca datele mele de contact să fie salvate pentru a primi o ofertă personalizată și informații
            legate de disponibilitate.
          </span>
        </label>

        {errors.fullName && <p className="error">{errors.fullName}</p>}
        {errors.phone && <p className="error">{errors.phone}</p>}

        <div className="input-group" style={{ marginTop: 12 }}>
          <button type="button" onClick={goBack}>
            Înapoi
          </button>
          <button type="submit">Continuă</button>
        </div>
      </form>
    </>
  );
};

export default Step3Contact;
