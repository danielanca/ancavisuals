import React, { useEffect, useRef, useState } from "react";
import "./CTAPreview.scss"

type EventTypeId = "nunta" | "botez" | "majorat" | "logodna";

interface EventTypeConfig {
  id: EventTypeId;
  label: string;
}

const EVENT_TYPES: EventTypeConfig[] = [
  { id: "nunta", label: "NUNTĂ" },
  { id: "botez", label: "BOTEZ" },
  { id: "majorat", label: "MAJORAT" },
  { id: "logodna", label: "CUNUNIE CIVILĂ" },
];

// Slider demo – doar efect vizual, nu logic real de preț
const MIN = 800;
const MAX = 6500;
const STEP = 80;

const ConfiguratorTeaser: React.FC = () => {
  const [selectedType, setSelectedType] = useState<EventTypeId>("nunta");
  const [value, setValue] = useState<number>(MIN);
  const [sliderAnimating, setSliderAnimating] = useState<boolean>(true);
  const [autoCycle, setAutoCycle] = useState<boolean>(true);
  const hasInteracted = useRef(false);
  const hasNavigated = useRef(false);

  // Helper redirect
  const goToConfigurator = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    window.location.href = "/contact";
    // Dacă folosești react-router:
    // navigate("/configurator");
  };

  // 1) Slider demo loop (merge constant între MIN și MAX)
  useEffect(() => {
    if (!sliderAnimating) return;

    const interval = setInterval(() => {
      setValue((prev) => {
        const next = prev + STEP;
        return next > MAX ? MIN : next;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [sliderAnimating]);

  // 2) Auto-cycle event types (schimbă activul la 3s, doar ca demo)
  useEffect(() => {
    if (!autoCycle) return;

    let currentIndex = EVENT_TYPES.findIndex((t) => t.id === selectedType);
    if (currentIndex === -1) currentIndex = 0;

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % EVENT_TYPES.length;
      setSelectedType(EVENT_TYPES[currentIndex].id);
    }, 3000);

    return () => clearInterval(interval);
  }, [autoCycle, selectedType]);

  // Click pe event → oprește demo + duce direct în configurator
  const handleSelectType = (id: EventTypeId) => {
    setSelectedType(id);
    setAutoCycle(false);
    setSliderAnimating(false);
    hasInteracted.current = true;
    goToConfigurator();
  };

  // User schimbă slider-ul manual → oprește demo + duce direct în configurator
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setValue(v);
  };

  const handleSliderInteract = () => {
    if (!hasInteracted.current) {
      hasInteracted.current = true;
      setSliderAnimating(false);
      setAutoCycle(false);
    }
    goToConfigurator();
  };

  const percentage = ((value - MIN) / (MAX - MIN)) * 100;

  const handleOpenConfigurator = () => {
    hasInteracted.current = true;
    setSliderAnimating(false);
    setAutoCycle(false);
    goToConfigurator();
  };

  const currentLabel =
    EVENT_TYPES.find((t) => t.id === selectedType)?.label || "EVENIMENT";

  return (
    <div className="config-teaser__outer-wrap">
    <div className="config-teaser config-teaser--glow">
      <div className="config-teaser__heading">
        VERIFICARE DISPONIBILITATE & REZERVARE
      </div>
      <div className="config-teaser__step-label">
        Vezi în câteva secunde cât ar putea costa pachetul tău. Click pentru a
        deschide configuratorul complet.
      </div>

      {/* Event type pills */}
      <div className="config-teaser__event-grid">
        {EVENT_TYPES.map((type) => {
          const isActive = type.id === selectedType;
          return (
            <button
              key={type.id}
              type="button"
              className={
                "config-teaser__event-btn" +
                (isActive ? " config-teaser__event-btn--active" : "")
              }
              onClick={() => handleSelectType(type.id)}
            >
              <span className="config-teaser__event-label">{type.label}</span>
              <span className="config-teaser__event-check">
                {isActive && <span className="config-teaser__event-dot" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="config-teaser__offer-label">OFERTA NOASTRĂ</div>

      <div className="config-teaser__price">
        <span>
          Demonstrație pentru <strong>{currentLabel}</strong> — configurabilă în
          următorul pas:
        </span>
        <strong>{value.toLocaleString("ro-RO")} RON</strong>
      </div>

      <p className="config-teaser__text">
        Slider-ul și tipurile de eveniment îți arată că oferta este flexibilă.
        Apasă oriunde pe acest modul pentru a deschide configuratorul și a-ți
        calcula prețul exact.
      </p>

      {/* Slider (click = navigate) */}
      <div
        className="config-teaser__slider-wrap"
        onClick={handleSliderInteract}
      >
        <div
          className="config-teaser__slider-fill"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={value}
          onChange={handleSliderChange}
          onMouseDown={handleSliderInteract}
          onTouchStart={handleSliderInteract}
          className="config-teaser__slider"
        />
      </div>

      <div className="config-teaser__scale">
        <span>Start simplu</span>
        <span>Pachet complet & premium</span>
      </div>

      {/* AFLI PE LOC + CTA */}
      <div className="config-teaser__instant-label">AFLI PE LOC</div>

      <button
        className="config-teaser__btn config-teaser__btn--pulse"
        onClick={handleOpenConfigurator}
      >
        Continuă în Configurator
      </button>
    </div>
    </div>
  );
};

export default ConfiguratorTeaser;
