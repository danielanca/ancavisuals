// Step4.tsx (fragment relevant)
import React, { useState, useMemo } from "react";
import PackageTiles from "../../pages/Contact/booking/components/PackageTiles";
import { PACKAGES, PACKAGES_NEW } from "./packages";

export default function Step4({ step, goBack, submit }: { step: number; goBack: () => void; submit: () => void }) {
  const [selectedPackages, setSelectedPackages] = useState<string[]>(["photo"]); // default

  const total = useMemo(
    () => selectedPackages.reduce((s, id) => s + (PACKAGES_NEW.find(p => p.id === id)?.price || 0), 0),
    [selectedPackages],
  );

  if (step !== 4) return null;

  return (
    <>
      <h3>4) Locație, interval & pachet</h3>

      {/* ...location + hours... */}

      <PackageTiles selected={selectedPackages} onChange={setSelectedPackages} />

      <div className="input-group" style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="button" onClick={goBack}>
          Înapoi
        </button>
        <button
          type="button"
          onClick={submit}
          aria-label={`Trimite cererea cu total ${total.toLocaleString("ro-RO")} EUR`}
        >
          Trimite cererea
        </button>
      </div>
    </>
  );
}
