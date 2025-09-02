import './styles.css';
import { useEffect, useMemo, useState } from 'react';
import { PACKAGES, CUSTOM_OPTIONS } from './packages';
import VisualOptionCard from './VisualOptionCard';
import LocationField, { PlaceLite } from './LocationField';
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
type Step = 1 | 2 | 3 | 4 | 5;
type EventType = 'nunta' | 'botez';

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
    fetch('/bookedDates.json')
      .then(r => r.json())
      .then((data: string[]) => setBookedDates(data.map(d => d.trim())))
      .catch(() => setBookedDates([]));
  }, []);

  // Check availability
  const checkAvailability = () => {
    const ok = !bookedDates.includes(selectedFormattedDate);
    setIsAvailable(ok);
    setErrors(ok ? {} : { date: 'Ne pare rău, suntem deja ocupați în acea zi.' });
  };

  // Price calc
  useEffect(() => {
    const selected = PACKAGES.find(p => p.key === packageType);
    if (selected) setPrice(selected.price);
    else {
      let total = 0;
      if (photo) total += CUSTOM_OPTIONS.find(o => o.key === 'photo')?.price || 0;
      if (video) total += CUSTOM_OPTIONS.find(o => o.key === 'video')?.price || 0;
      setPrice(total);
    }
  }, [packageType, photo, video]);

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
    if (resp?.ok) setSubmitted(true);
    else alert('A apărut o problemă la trimitere.');
  };

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
          {isAvailable === true && <p className='ok'>Suntem disponibili în acea zi 🎉</p>}
          <div style={{ marginTop: 12 }}>
            <button disabled={isAvailable !== true} onClick={goNext}>
              Continuă
            </button>
          </div>
        </>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <>
          <h3>2) Tipul evenimentului</h3>
          <div className='input-group'>
            <label>
              <input
                type='radio'
                name='eventType'
                value='nunta'
                checked={eventType === 'nunta'}
                onChange={() => setEventType('nunta')}
              />{' '}
              Nuntă
            </label>
            <label>
              <input
                type='radio'
                name='eventType'
                value='botez'
                checked={eventType === 'botez'}
                onChange={() => setEventType('botez')}
              />{' '}
              Botez
            </label>
          </div>
          {errors.eventType && <p className='error'>{errors.eventType}</p>}
          <div style={{ marginTop: 12 }}>
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
            onSubmit={e => {
              e.preventDefault();
              goNext();
            }}
            className='booking-form'
          >
            <input type='text' placeholder='Numele tău' value={fullName} onChange={e => setFullName(e.target.value)} />
            <input
              type='tel'
              placeholder='Numărul tău de telefon'
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            {errors.fullName && <p className='error'>{errors.fullName}</p>}
            {errors.phone && <p className='error'>{errors.phone}</p>}
            <div style={{ marginTop: 12 }}>
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

              {packageType === 'custom' && (
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
                      return <VisualOptionCard key={opt.key} opt={opt as any} checked={checked} onChange={toggle} />;
                    })}
                  </div>
                </div>
              )}

              {errors.package && <p className='error'>{errors.package}</p>}
              <p className='total-price'>Preț estimativ: {price} RON</p>
            </div>

            <div style={{ marginTop: 12 }}>
              <button onClick={goBack}>Înapoi</button>
              <button onClick={submitBooking}>Trimite cererea</button>
            </div>
          </div>
        </>
      )}

      {/* Step 5 */}
      {(step === 5 || submitted) && (
        <div style={{ marginTop: 16 }}>
          <h3>5 Cererea nu a fost trimisa!</h3>
          <p>
            Deoarece inca lucram la acest formular sa functioneze perfect. Contacteaza-ne la 0745469907{' '}
            {selectedFormattedDate}.
          </p>
        </div>
      )}
    </div>
  );
}
