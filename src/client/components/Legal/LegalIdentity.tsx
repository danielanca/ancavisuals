import React from "react";
import { Link } from "react-router-dom";
import { ANPC_SAL_URL, ANPC_URL, LEGAL_ENTITY } from "../../../shared/legalEntity";
import { openCookieSettings } from "../../utils/cookieConsent";

// Who the visitor is paying (Legea 365/2002): firm identity + legal links. Shared by the main
// Footer and the /oferta/:slug footer. Phone is left out on purpose — it stays behind
// PhoneNumberReveal so phone_revealed tracking keeps working.
const LegalIdentity = ({ className = "", light = false }: { className?: string; light?: boolean }) => {
  const { name, cui, regCom, address, email } = LEGAL_ENTITY;
  const linkClass = `underline underline-offset-2 ${light ? "hover:text-black" : "hover:text-white"} transition-colors`;

  return (
    <div className={`text-[11px] leading-relaxed ${className}`}>
      <p>
        {name} · CUI {cui}
        {regCom && <> · {regCom}</>} · {address} ·{" "}
        <a href={`mailto:${email}`} className={linkClass}>
          {email}
        </a>
      </p>
      <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Link to="/terms" className={linkClass}>
          Termeni și condiții
        </Link>
        <Link to="/privacy" className={linkClass}>
          Politica de confidențialitate
        </Link>
        <Link to="/copyright" className={linkClass}>
          Copyright
        </Link>
        <button type="button" onClick={openCookieSettings} className={`${linkClass} bg-transparent border-none p-0 cursor-pointer`}>
          Setări cookie
        </button>
        <a href={ANPC_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
          ANPC
        </a>
        <a href={ANPC_SAL_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
          ANPC – SAL
        </a>
      </p>
    </div>
  );
};

export default LegalIdentity;
