import React from "react";
import { EventType } from "../types";

interface Step2EventTypeProps {
  eventType: EventType;
  setEventType: (type: EventType) => void;
}

const EVENT_OPTIONS: {
  id: EventType;
  label: string;
  description: string;
}[] = [
  {
    id: "nunta",
    label: "Nuntă",
    description: "Pachet complet pentru ziua nunții."
  },
  {
    id: "botez",
    label: "Botez",
    description: "Momente importante pentru cel mic."
  },
  {
    id: "majorat",
    label: "Majorat",
    description: "Petrecere 18+ plină de energie."
  },
  {
    id: "logodna",
    label: "Cununie civilă / Logodnă",
    description: "Ceremonie intimă & elegantă."
  },
  // dacă folosești "altceva" în EventType și UI:
  // {
  //   id: "altceva",
  //   label: "Alt tip de eveniment",
  //   description: "Spune-ne mai multe detalii în pasul următor."
  // },
];

const Step2EventType: React.FC<Step2EventTypeProps> = ({
  eventType,
  setEventType
}) => {
  return (
    <div>
      <p className="step-title">2) Event type</p>

      <div className="event-type-grid">
        {EVENT_OPTIONS.map((opt) => {
          const active = opt.id === eventType;

          return (
            <button
              key={opt.id}
              type="button"
              className={
                "event-type-tile" +
                (active
                  ? " event-type-tile--active"
                  : "")
              }
              onClick={() => setEventType(opt.id)}
            >
              <div className="event-type-label">
                {opt.label}
              </div>
              <div className="event-type-desc">
                {opt.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Step2EventType;
