// src/booking/steps/Step2EventType.tsx
import React from 'react';
import '../segmented.scss';

export default function Step2EventType() {
  return (
    <fieldset className='tiles'>
      <legend>2) Tipul evenimentului</legend>
      {[
        { id: 'evt-nunta', label: 'Nuntă', value: 'nunta' },
        { id: 'evt-botez', label: 'Botez', value: 'botez' },
        { id: 'evt-majorat', label: 'Majorat', value: 'majorat' },
        { id: 'evt-cununie', label: 'Cununie Civilă / Logodnă', value: 'cununie' },
        { id: 'evt-altceva', label: 'Altceva', value: 'altceva' },
      ].map((o, i) => (
        <div className='tile' key={o.id}>
          <input type='radio' name='eventType' id={o.id} value={o.value} defaultChecked={i === 0} />
          <label htmlFor={o.id}>
            <span className='title'>{o.label}</span>
            <span className='check' aria-hidden>
              ✓
            </span>
          </label>
        </div>
      ))}
    </fieldset>
  );
}
