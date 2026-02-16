import { useState } from 'react';
import "./styles.css";
import "./segmented.scss";
import styles from './AdminBook.module.scss';

// Steps
import Step1Date from "./steps/Step1Date";

import { Step, EventType, Errors } from "./types";

export default function AdminBook() {
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  
    const [errors, setErrors] = useState<Errors>({});

    // Step 1 – data
    const [day, setDay] = useState(1);
    const [month, setMonth] = useState(0); // 0-based
    const [year, setYear] = useState(2025);
    const [bookedDates, setBookedDates] = useState<string[]>([]);
    const [isAvailable, setIsAvailable] = useState<null | boolean>(null);
  

  const MONTHS_RO = [
    "Ianuarie",
    "Februarie",
    "Martie",
    "Aprilie",
    "Mai",
    "Iunie",
    "Iulie",
    "August",
    "Septembrie",
    "Octombrie",
    "Noiembrie",
    "Decembrie",
  ];
  // same handleSubmit function as above...

  const getMonthDate = (checkDate:string) => {
    let getDate = Number(checkDate.split("-")[2]);
    let getMonth = Number(checkDate.split("-")[1]);
    let wordMonth =  MONTHS_RO[getMonth-1];

    return `${getDate} ${wordMonth}`;



  }

  const handleSubmit = async () => {


    try {
       const res = await fetch(`/api/event/booked`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
          date : date,
          title : title,
          desc:description,
          dbStore : getMonthDate(date)
      }),
       });
       
       if (res.ok) {
          console.log(res.json());
       }
 
     } catch (err) {
       console.error(err);
     }

  }
  return (
    <div className={styles.page}>
      <div className={styles.formContainer}>
        <h1 className={styles.title}>Register New Date</h1>
        <p className={styles.subtitle}>Add event / album / important date</p>

        {success && <div className={styles.successMessage}>Date saved successfully!</div>}
        {error && <div className={styles.errorMessage}>{error}</div>}

        <form className={styles.form}>
          <div className={styles.field}>
            <label>Date <span className={styles.required}>*</span></label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className={styles.input}
            />
          </div>
          <div className={styles.field}>
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
            <label>Description / Notes</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Additional details..."
              rows={4}
              className={styles.textarea}
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit} 
            disabled={loading}
            className={`${styles.submitBtn} ${loading ? styles.submitLoading : ''}`}
          >
            {loading ? 'Saving...' : 'Save Date'}
          </button>
        </form>
      </div>
    </div>
  );
}