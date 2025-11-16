import './styles.css';
import './segmented.scss';
import { useEffect, useMemo, useState } from 'react';
import { PACKAGES } from './packages';
import VisualOptionCard from './VisualOptionCard';
import LocationField, { PlaceLite } from './LocationField';
import PackageTiles from './../Contact/booking/components/PackageTiles';
import { PACKAGES_NEW } from './packages';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string;
// ---------- Vite env ----------
const IS_PROD = import.meta.env.PROD;
const API_BASE = ''; // same-origin (prod & dev)
const BOOKING_TO = import.meta.env.VITE_BOOKING_EMAIL ?? 'you@example.com';

// ---------- Utils ----------
const pad2 = (n: number) => (n < 10 ? '0' : '') + n;
const formatDate = (d: number, mi: number, y: number) => `${pad2(d)}/${pad2(mi + 1)}/${y}`;
const PHONE_RE = /^[0-9+\s()-]{8,20}$/;
const parseTimeToMinutes = (t: string) => {
  if (!t) return null;
  const [hh, mm] = t.split(':').map(Number);
  return Number.isNaN(hh) || Number.isNaN(mm) ? null : hh * 60 + mm;
};

// ---------- API helper (tolerant text/JSON) ----------
async function safeTrigger(payload: any) {
  try {
    const res = await fetch(`${API_BASE}/triggerEvent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, ...json };
    } else {
      await res.text().catch(() => '');
      return { ok: res.ok };
    }
  } catch (e) {
    if (!IS_PROD) {
      console.log('[dev] /triggerEvent fallback:', payload);
      return { ok: true, dev: true };
    }
    throw e;
  }
}

// ---------- Component ----------
// ---------- Component ----------
type Step = 1 | 2 | 3 | 4 | 5;

// sursa unică de adevăr pt opțiuni — tipizată corect:
const EVENT_OPTIONS = [
  { id: 'evt-nunta',   label: 'Nuntă',                         value: 'nunta'   },
  { id: 'evt-botez',   label: 'Botez',                         value: 'botez'   },
  { id: 'evt-majorat', label: 'Majorat',                       value: 'majorat' },
  { id: 'evt-cununie', label: 'Cununie Civilă / Logodnă',      value: 'cununie' },
  { id: 'evt-altceva', label: 'Altceva',                       value: 'altceva' },
] as const;

type EventType = (typeof EVENT_OPTIONS)[number]['value']; // "nunta" | "botez" | "majorat" | "cununie" | "altceva"

export default function BookingWizard() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 – data
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState(2025);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [isAvailable, setIsAvailable] = useState<null | boolean>(null);

  // Step 2 – tip
  const [eventType, setEventType] = useState<EventType>('nunta');

  // Step 3 – contact
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Step 4 – locație + timp + pachet
  const [location, setLocation] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [packageType, setPackageType] = useState('basic');
  const [photo, setPhoto] = useState(false);
  const [video, setVideo] = useState(false);
  const [price, setPrice] = useState(1500);

  // Final
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedFormattedDate = useMemo(() => formatDate(day, month, year), [day, month, year]);

  // Fixtures
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    'Ianuarie',
    'Februarie',
    'Martie',
    'Aprilie',
    'Mai',
    'Iunie',
    'Iulie',
    'August',
    'Septembrie',
    'Octombrie',
    'Noiembrie',
    'Decembrie',
  ];
  const years = [2025, 2026, 2027];

  // Load booked dates
  useEffect(() => {
    console.log('local bookedDates)');
    // fetch('/bookedDates.json')
    //   .then(r => r.json())
    //   .then((data: string[]) => setBookedDates(data.map(d => d.trim())))
    //   .catch(() => setBookedDates([]));
  }, []);

  // Check availability
  const checkAvailability = () => {
    const ok = !bookedDates.includes(selectedFormattedDate);
    setIsAvailable(ok);
    setErrors(ok ? {} : { date: 'Ne pare rău, suntem deja ocupați în acea zi.' });
  };


  // Duration calc (informativ)
  const durationInfo = useMemo(() => {
    const s = parseTimeToMinutes(startTime);
    const e = parseTimeToMinutes(endTime);
    if (s == null || e == null) return { hours: null as number | null, overnight: false };
    const overnight = e < s;
    const mins = overnight ? 24 * 60 - s + e : e - s;
    const hours = Math.round((mins / 60) * 10) / 10;
    return { hours, overnight };
  }, [startTime, endTime]);

  // Validate per-step
  const validateStep = (s: Step) => {
    const errs: Record<string, string> = {};
    if (s === 1 && isAvailable !== true) errs.date = 'Verifică disponibilitatea înainte să continui.';
    if (s === 2 && !eventType) errs.eventType = 'Alege tipul de eveniment.';
    if (s === 3) {
      if (!fullName.trim()) errs.fullName = 'Completează numele.';
      if (!phone || !PHONE_RE.test(phone)) errs.phone = 'Număr de telefon invalid.';
    }
    if (s === 4) {
      if (!location.trim()) errs.location = 'Completează locația.';
      if (!startTime) errs.startTime = 'Alege ora de început.';
      if (!endTime) errs.endTime = 'Alege ora de sfârșit.';
      if (!packageType) errs.package = 'Alege un pachet.';
      if (packageType === 'custom' && !photo && !video) errs.package = 'Alege cel puțin o opțiune.';
      if (startTime && endTime && startTime === endTime) errs.endTime = 'Start și final nu pot fi egale.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => validateStep(step) && setStep(s => (s < 5 ? ((s + 1) as Step) : s));
  const goBack = () => setStep(s => (s > 1 ? ((s - 1) as Step) : s));

  // Submit
  const submitBooking = async () => {
    if (!validateStep(4)) return setStep(4);

    const subject = `Cerere ${eventType.toUpperCase()} – ${selectedFormattedDate}`;
    const html = `
      <h2>Cerere nouă</h2>
      <ul>
        <li><b>Data:</b> ${selectedFormattedDate}</li>
        <li><b>Eveniment:</b> ${eventType}</li>
        <li><b>Nume:</b> ${fullName}</li>
        <li><b>Telefon:</b> ${phone}</li>
        <li><b>Locație:</b> ${location}</li>
        <li><b>Interval:</b> ${startTime} – ${endTime}${durationInfo.overnight ? ' (peste miezul nopții)' : ''}</li>
        <li><b>Durată estimată:</b> ${durationInfo.hours ?? '-'} h</li>
        <li><b>Pachet:</b> ${packageType}${
          packageType === 'custom' ? ` (foto=${photo ? 'da' : 'nu'}, video=${video ? 'da' : 'nu'})` : ''
        }</li>
        <li><b>Preț estimativ:</b> ${price} RON</li>
      </ul>
    `;

    // trimitem și payload structurat (serverul poate calcula km/motorină)
    const booking = {
      date: selectedFormattedDate,
      eventType,
      fullName,
      phone,
      location,
      placeId,
      startTime,
      endTime,
      overnight: durationInfo.overnight,
      durationHours: durationInfo.hours,
      packageType,
      options: packageType === 'custom' ? { photo, video } : null,
      price,
    };

    const resp = await safeTrigger({ to: BOOKING_TO, subject, html, booking });
    if (resp?.ok) {
      setSubmitted(true);
      setStep(5); // mergi la pasul 5 pe succes
    } else {
      alert('A apărut o problemă la trimitere.');
    }

  // ---------- UI ----------
  return (
    <div className='booking-container'>
      <h2>Rezervare & Disponibilitate</h2>

      {/* stepper */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map(s => (
          <div
            key={s}
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: step >= s ? '#f4d35e' : '#444',
            }}
          />
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <>
          <h3>1) Alege data</h3>
          <div className='input-group'>
            <select value={day} onChange={e => setDay(parseInt(e.target.value))}>
              {days.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
              {months.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {years.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button onClick={checkAvailability}>Verifică</button>
          </div>
          <p style={{ fontSize: 12, color: '#888' }}>Data selectată: {selectedFormattedDate}</p>
          {errors.date && <p className='error'>{errors.date}</p>}
          {isAvailable === true && <p className='ok'>Suntem disponibili în data de {selectedFormattedDate} 🎉</p>}
          <div className='input-group' style={{ marginTop: 12 }}>
            <button disabled={isAvailable !== true} onClick={goNext}>
              Continuă
            </button>
          </div>
        </>
      )}

   {/* Step 2 */}
{step === 2 && (
  <>
    <fieldset className='tiles'>
      <legend>2) Tipul evenimentului</legend>

      {EVENT_OPTIONS.map(o => (
        <div className='tile' key={o.id}>
          <input
            type='radio'
            name='eventType'
            id={o.id}
            value={o.value}
            checked={eventType === o.value}
            onChange={(e) => setEventType(e.currentTarget.value as EventType)}
          />
          <label htmlFor={o.id}>
            <span className='title'>{o.label}</span>
            <span className='check' aria-hidden>✓</span>
          </label>
        </div>
      ))}
    </fieldset>

    {errors.eventType && <p className='error'>{errors.eventType}</p>}
    <div className='input-group' style={{ marginTop: 12 }}>
      <button onClick={goBack}>Înapoi</button>
      <button onClick={goNext}>Continuă</button>
    </div>
  </>
)}

      {/* Step 3 */}
      {step === 3 && (
        <>
          <h3>3) Detalii de contact</h3>
          <form
            autoComplete='on' // permite managerului de profil să propună date salvate
            onSubmit={e => {
              e.preventDefault();
              goNext();
            }}
            className='booking-form'
          >
            <label htmlFor='contact-name' className='sr-only'>
              Numele tău
            </label>
            <input
              id='contact-name'
              type='text'
              placeholder='Numele tău'
              name='name' // token standard
              autoComplete='name' // declanșează sugestiile din browser
              autoCapitalize='words'
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              inputMode='text'
            />

            <label htmlFor='contact-phone' className='sr-only'>
              Numărul tău de telefon
            </label>
            <input
              id='contact-phone'
              type='tel'
              placeholder='Numărul tău de telefon'
              name='tel' // token standard
              autoComplete='tel' // poate fi și "tel-national" dacă vrei format local
              inputMode='tel'
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />

            {errors.fullName && <p className='error'>{errors.fullName}</p>}
            {errors.phone && <p className='error'>{errors.phone}</p>}

            <div className='input-group' style={{ marginTop: 12 }}>
              <button type='button' onClick={goBack}>
                Înapoi
              </button>
              <button type='submit'>Continuă</button>
            </div>
          </form>
        </>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <>
          <h3>4) Locație, interval & pachet</h3>
          <div className='booking-form' style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <LocationField
              apiKey={MAPS_KEY}
              value={location}
              onChange={v => {
                setLocation(v);
                setPlaceId(null); // dacă userul rescrie manual, invalidăm selecția
              }}
              onSelect={(p: PlaceLite) => {
                // 🆕 folosim formattedAddress / displayName / id (nu formatted_address / place_id)
                setLocation(p.formattedAddress || p.displayName || '');
                setPlaceId(p.id || null);
              }}
              language='ro'
              region='RO'
            />
            {errors.location && <p className='error'>{errors.location}</p>}

            <div className='time-range' style={{ display: 'flex', gap: 12 }}>
              <label>
                De la ora:
                <input
                  type='time'
                  step='1800'
                  list='halfHourSteps'
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                />
              </label>
              <label>
                Până la ora:
                <input
                  type='time'
                  step='1800'
                  list='halfHourSteps'
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                />
              </label>
              <datalist id='halfHourSteps'>
                {Array.from({ length: 36 }, (_, i) => {
                  const h = 6 + Math.floor(i / 2);
                  const m = i % 2 === 0 ? '00' : '30';
                  return <option key={`${h}:${m}`} value={`${pad2(h)}:${m}`} />;
                })}
              </datalist>
            </div>
            {(errors.startTime || errors.endTime) && <p className='error'>{errors.startTime || errors.endTime}</p>}

            {/* Durată estimată */}
            {durationInfo.hours != null && (
              <p style={{ fontSize: 12, color: '#aaa' }}>
                Durată estimată: <b>{durationInfo.hours}h</b>
                {durationInfo.overnight ? ' (trece de miezul nopții)' : ''}
              </p>
            )}

            {/* Pachete */}
            <div className='price-configurator' style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p>
                <strong>Alege un pachet:</strong>
              </p>
              {[...PACKAGES, { key: 'custom', label: 'Personalizat', description: '' }].map((pkg: any) => (
                <label key={pkg.key} style={{ display: 'block' }}>
                  <input
                    type='radio'
                    name='pachet'
                    value={pkg.key}
                    checked={packageType === pkg.key}
                    onChange={() => setPackageType(pkg.key)}
                  />{' '}
                  {pkg.label} {pkg.description ? `(${pkg.description})` : ''}
                </label>
              ))}

              {/* {packageType === 'custom' && (
                <div style={{ marginTop: '0.5rem' }}>
                  <p style={{ fontStyle: 'italic', color: '#f4d35e' }}>
                    Surpriză: alegi foto sau video și primești automat și partenerul – fără costuri!
                  </p>
                  <div className='opt-grid'>
                    {CUSTOM_OPTIONS.map(opt => {
                      const isAlbum = opt.key === 'album';
                      const checked = isAlbum ? true : opt.key === 'photo' ? photo : video;
                      const toggle = () => {
                        if (isAlbum) return;
                        if (opt.key === 'photo') setPhoto(!photo);
                        else if (opt.key === 'video') setVideo(!video);
                      };
                      return <VisualOptionCard key={opt.key} opt={opt as any} checked={checked} onToggle={toggle} />;
                    })}
                  </div>
                </div>
              )} */}

              {errors.package && <p className='error'>{errors.package}</p>}
              <p className='total-price'>Preț: {price} RON</p>
            </div>

            <div className='input-group' style={{ marginTop: 12 }}>
              <button onClick={goBack}>Înapoi</button>
              <button onClick={submitBooking}>Trimite cererea</button>
            </div>
          </div>
        </>
      )}

      {/* Step 5 */}
      {step === 5 && (
        <div style={{ marginTop: 16 }}>
          {submitted ? (
            <>
              <h3>✔ Cererea a fost trimisă!</h3>
              <p>Îți mulțumim. Revenim în scurt timp pe {phone || 'telefon'} / email.</p>
            </>
          ) : (
            <>
              <h3>❌ Cererea nu a fost trimisă</h3>
              <p>Ne poți suna direct la 0745469907 pentru rezervare în {selectedFormattedDate}.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}}
