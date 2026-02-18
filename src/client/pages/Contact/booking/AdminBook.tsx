import { useState, useEffect } from 'react';
import styles from './AdminBook.module.scss';
import Step1Date from "./steps/AdminStepDate";
import { Errors } from "./types"; // adjust import as needed

export default function AdminBook() {
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(0); // 0-based
  const [year, setYear] = useState(2025);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [isAvailable, setIsAvailable] = useState<null | boolean>(null);

  // NEW: modal visibility after successful submit
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Debounced availability check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (day >= 1 && month >= 0 && year >= 2024) {
        const newDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setDate(newDate);
        handleCheckAvailability(newDate); // pass date explicitly
      } else {
        setDate('');
        setIsAvailable(null);
      }
    }, 500); // 500ms debounce – feel free to adjust

    return () => clearTimeout(timer);
  }, [day, month, year]);

  const MONTHS_RO = [
    "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
    "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
  ];

  const getMonthDate = (checkDate: string) => {
    if (!checkDate) return '';
    const [y, m, d] = checkDate.split('-').map(Number);
    const wordMonth = MONTHS_RO[m - 1];
    return `${d} ${wordMonth}`;
  };

  const handleCheckAvailability = async (currentDate: string = date) => {
    if (!currentDate) return;

    try {
      const res = await fetch(`/api/event/date-available`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: currentDate,
          dbStore: getMonthDate(currentDate),
        }),
      });

      const data = await res.json();

      if (res.ok && data.available !== undefined) {
        setIsAvailable(!!data.available);
        if (!data.available) {
          setErrors(prev => ({
            ...prev,
            date: data.message || "Această dată este deja rezervată.",
          }));
        } else {
          setErrors(prev => { const { date, ...rest } = prev; return rest; });
        }
      } else {
        setIsAvailable(null);
        setErrors(prev => ({ ...prev, date: data.error || "Eroare la verificare." }));
      }
    } catch (err) {
      console.error("Availability check failed:", err);
      setIsAvailable(null);
      setErrors(prev => ({ ...prev, date: "Nu s-a putut verifica disponibilitatea." }));
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setErrors({});

    // Basic client-side validation
    if (!date || isAvailable !== true) {
      setError("Verifică disponibilitatea datei și asigură-te că este liberă.");
      return;
    }
    if (!title.trim() || !phone.trim() || !price.trim()) {
      setError("Completează titlul, telefonul și prețul.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/event/register-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          title,
          phone,
          price,
          desc: description,
          dbStore: getMonthDate(date),
        }),
      });

      const result = await res.json();

      if (res.ok) {
        setSuccess(true);
        setShowSuccessModal(true); // ← show modal
        // Optional: reset form
        // setTitle(''); setPhone(''); setPrice(''); setDescription(''); ...
      } else {
        setError(result.error || "Eroare la înregistrare.");
      }
    } catch (err) {
      console.error(err);
      setError("Eroare de conexiune. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  };

  // NEW: Generate Google Calendar link
  const getGoogleCalendarLink = () => {
    if (!date || !title) return '#';

    // Parse date – assumes full-day event (adjust if you have time)
    const [y, m, d] = date.split('-');
    const start = `${y}${m}${d}T000000Z`; // midnight UTC
    const end   = `${y}${m}${d}T235959Z`; // end of day UTC

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${start}/${end}`,
      details: description ? `Descriere: ${description}\nTelefon: ${phone}\nPreț: ${price}` : '',
      location: '', // add if you have venue
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  return (
    <div className={styles.page}>
      <div className={styles.formContainer}>
        <h1 className={styles.title}>Register New Date</h1>
        <p className={styles.subtitle}>Add event / album / important date</p>

        {success && <div className={styles.successMessage}>Date saved successfully!</div>}
        {error && <div className={styles.errorMessage}>{error}</div>}

        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          {/* Date field */}
          <div className={styles.field}>
            <label>Date <span className={styles.required}>*</span></label>
            <Step1Date
              day={day}
              month={month}
              year={year}
              setDay={setDay}
              setMonth={setMonth}
              setYear={setYear}
              bookedDates={bookedDates}
              isAvailable={isAvailable}
              setIsAvailable={setIsAvailable}
              setErrors={setErrors}
            />
           </div>

          <div className={styles.field}>
            <label>Title / Event name <span className={styles.required}>*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Wedding – Ana & Mihai"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label>Phone Number<span className={styles.required}>*</span></label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+40 745 *** ***"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label>Price: <span className={styles.required}>*</span></label>
            <input
              type="text"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="1000 Ron"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label>Description / Notes</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Additional details..."
              rows={4}
              className={styles.textarea}
            />
          </div>

 

          {/* Other fields – title, phone, price, description */}
          {/* ... (keep as is) ... */}

          <button
            type="submit" // changed to submit – better semantics
            disabled={loading || isAvailable !== true}
            className={`${styles.submitBtn} ${loading ? styles.submitLoading : ''}`}
          >
            {loading ? 'Se salvează...' : 'Salvează Evenimentul'}
          </button>
        </form>
      </div>

      {/* ───────────────────────────────────────────────
          SUCCESS MODAL
      ─────────────────────────────────────────────── */}
      {showSuccessModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSuccessModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2>🎉 Felicitări!</h2>
            <p>Evenimentul „{title}” a fost înregistrat cu succes pentru data de {getMonthDate(date)}.</p>

            <div style={{ margin: '1.5rem 0', textAlign: 'center' }}>
              <a
                href={getGoogleCalendarLink()}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.googleCalendarBtn}
              >
                Adaugă în Google Calendar
              </a>
            </div>

            <button
              onClick={() => setShowSuccessModal(false)}
              className={styles.closeModalBtn}
            >
              Închide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}