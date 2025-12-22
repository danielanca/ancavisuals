import React from "react";
import { EventType } from "../types";

interface Step2EventTypeProps {
  eventType: EventType;
  setEventType: (type: EventType) => void;
}

const Step2EventType: React.FC<Step2EventTypeProps> = ({ eventType, setEventType }) => {
  return (
    <div>
      <p className="step-title">2) Tipul evenimentului</p>

      {/* Folosim stilurile existente din segmented.scss */}
      <div className="segmented">
        <button type="button" className={eventType === "nunta" ? "active" : ""} onClick={() => setEventType("nunta")}>
          Nuntă
        </button>

        <button type="button" className={eventType === "botez" ? "active" : ""} onClick={() => setEventType("botez")}>
          Botez
        </button>

        <button
          type="button"
          className={eventType === "majorat" ? "active" : ""}
          onClick={() => setEventType("majorat")}
        >
          Majorat
        </button>

        <button
          type="button"
          className={eventType === "logodna" ? "active" : ""}
          onClick={() => setEventType("logodna")}
        >
          Cununie civilă / Logodnă
        </button>
      </div>
    </div>
  );
};

export default Step2EventType;
