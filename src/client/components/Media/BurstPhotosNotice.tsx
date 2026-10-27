import React from "react";

// Owner, 2026-10-27: in a burst, Daniel may pick one frame and Estera the next one, so the votes
// split between near-identical photos. Asking everyone to pick every frame they like keeps them together.
export default function BurstPhotosNotice() {
  return (
    <p role="note" style={{ margin: 0, padding: "12px 14px", background: "#fde047", color: "#111", fontSize: "17px", fontWeight: 700, lineHeight: 1.4 }}>
      📸 Poze aproape identice (din aceeași rafală)? Dacă îți plac, <span style={{ textDecoration: "underline" }}>bifează-le pe toate</span>, nu doar una.
      <span style={{ display: "block", marginTop: "4px", fontSize: "14px", fontWeight: 500 }}>
        Așa voturile tuturor ajung la aceleași poze și vedem corect ce ne place la mai mulți.
      </span>
    </p>
  );
}
