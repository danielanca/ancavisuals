import { useState, useEffect } from 'react';
import './WeddingInvitation.scss';
import '@fontsource/cairo/300.css';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import parse from 'html-react-parser'



const WeddingInvitation = () => {
  const [adulti, setAdulti] = useState(1);
  const [copii, setCopii] = useState(0);
  const [selectedMsg, setSelectedMsg] = useState('');
  const [status, setStatus] = useState<'vin' | 'nu' | null>(null);


  const weddingDate = new Date(2028, 4, 23, 0, 0, 0); // May 23, 2028

const [timeLeft, setTimeLeft] = useState({
  days: '??',
  hours: '??',
  minutes: '??',
  seconds: '??',
});

useEffect(() => {
  const updateTimer = () => {
    const now = new Date().getTime();
    const diff = weddingDate.getTime() - now;

    if (diff <= 0) {
      setTimeLeft({ days: '00', hours: '00', minutes: '00', seconds: '00' });
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setTimeLeft({
      days: String(days).padStart(2, '0'),
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
    });
  };

  updateTimer(); // Run immediately on mount
  const interval = setInterval(updateTimer, 1000);

  return () => clearInterval(interval);
}, []);

  // All text in one object - easy to replace with API fetch later
  const texts = {
    title: "Estera & Daniel - Wedding Invitation",
    names: "ESTERA ♥ DANIEL",
    eventDate: "MAY 23, 2028",
    eventLocation: "Cluj-Napoca",
    tagline: "We warmly invite you to celebrate<br>our love together",
    countdownTitle: "...until we say \"I do\" there are left",
    daysLabel: "days",
    hoursLabel: "hours",
    minutesLabel: "minutes",
    secondsLabel: "seconds",
    rsvpTitle: "Please confirm your attendance",
    attendingWith: "Attending with:",
    adultsLabel: "adults",
    childrenLabel: "children",
    menuPreference: "Menu preference (for the group):",
    menuMeat: "Meat menu",
    menuVegetarian: "Vegetarian",
    menuVegan: "Vegan",
    menuMixed: "Mixed / Doesn't matter",
    chooseMessage: "Choose a message for us (optional):",
    message1: "Yes, of course we'll be there! Can't wait 💋",
    message2: "Congratulations! We're coming with great joy ❤️",
    message3: "We can't miss it! Best wishes and much happiness 🎉",
    message4: "Thank you for the invitation! We confirm our presence 😊",
    anythingElse: "Anything else you'd like to tell us? (optional)",
    placeholderAnything: "e.g.: We'd love if you could come with your partner/spouse, food allergies, special requests, wishes etc...",
    reminderText: "Click the button below → your response will be recorded directly on the site!",
    confirmBtn: "I'll be there! ✓",
    declineBtn: "Sorry, I can't make it ✗",
    thanksVin: "Great! You have accepted to come to the wedding. See you there! ♡",
    thanksNu: "We're sorry you cannot be with us... we hug you anyway! ❤️",
    changeMind: "I've changed my mind?",
    addToCalendar: "Add to Calendar 📅",
    whereToFindUs: "Where to find us",
    civilCeremony: "Civil Ceremony",
    cityHall: "Cluj-Napoca City Hall",
    religiousCeremony: "Religious Ceremony",
    stMichaelChurch: "St. Michael's Church",
    reception: "Reception",
    hapHap: "Hap & Hap Restaurant",
    civilAddress: "Piața Unirii 1, Cluj-Napoca",
    churchAddress: "Piața Unirii, Cluj-Napoca",
    receptionAddress: "Strada Memorandumului 8, Cluj-Napoca",
    howToGetCivil: "How to get to the civil ceremony →",
    howToGetChurch: "How to get to the church →",
    howToGetReception: "How to get to the reception →",
    redirectNote: "You will be redirected to Google Maps / Maps / Apple Maps depending on your phone",
    allLocationsNote: "All locations are in the city center, just a few steps from each other.",
    accommodation: "Accommodation:",
    accommodationText: "We recommend hotels in the center (DoubleTree by Hilton, Hampton by Hilton, Hotel Platinia etc.) – 5-10 minutes from the venues",
    finalNote: "Please confirm as soon as possible<br>Your response will be recorded automatically on the site.<br>Thank you from the bottom of our hearts! ♡"
  };

  // Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = weddingDate.getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft({ days: '00', hours: '00', minutes: '00', seconds: '00' });
        return;
      }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeLeft({
        days: String(days).padStart(2, '0'),
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0'),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load saved status
  useEffect(() => {
    const saved = localStorage.getItem('rsvpStatus');
    if (saved === 'vin' || saved === 'nu') {
      setStatus(saved as 'vin' | 'nu');
    }
  }, []);

  const changeCount = (type: 'adulti' | 'copii', delta: number) => {
    if (type === 'adulti') {
      setAdulti((prev) => Math.max(1, prev + delta));
    } else {
      setCopii((prev) => Math.max(0, prev + delta));
    }
  };

  const handleMessageClick = (msg: string) => {
    setSelectedMsg(msg);
  };

  const sendConfirmation = (accept: boolean) => {
    const response = accept ? 'Yes, coming' : 'No, cannot come';

    const payload = {
      response,
      adults: adulti,
      children: copii,
      menu: (document.getElementById('meniu') as HTMLSelectElement)?.value || 'not specified',
      chosenMessage: selectedMsg,
      mention: (document.getElementById('mentiune') as HTMLTextAreaElement)?.value.trim(),
    };

    console.log('Response sent to API:', payload);

    localStorage.setItem('rsvpStatus', accept ? 'vin' : 'nu');
    setStatus(accept ? 'vin' : 'nu');
  };

  const resetConfirmation = () => {
    if (window.confirm('Are you sure you want to change your response?')) {
      localStorage.removeItem('rsvpStatus');
      setStatus(null);
      (document.getElementById('mentiune') as HTMLTextAreaElement).value = '';
    }
  };

  return (
    <div className="container">
      <div className="header">
        <div className="names">{texts.names}</div>

        <div className="event-date">
          {texts.eventDate}
          <span>{texts.eventLocation}</span>
        </div>

        <p className="tagline">{texts.tagline}</p>
      </div>

      <div className="countdown-section">
        <div className="countdown-title">{parse(texts.countdownTitle)}</div>
        <div className="timer">
          <div className="unit">
            <div className="number">{timeLeft.days}</div>
            <div className="label">{texts.daysLabel}</div>
          </div>
          <div className="unit">
            <div className="number">{timeLeft.hours}</div>
            <div className="label">{texts.hoursLabel}</div>
          </div>
          <div className="unit">
            <div className="number">{timeLeft.minutes}</div>
            <div className="label">{texts.minutesLabel}</div>
          </div>
          <div className="unit">
            <div className="number">{timeLeft.seconds}</div>
            <div className="label">{texts.secondsLabel}</div>
          </div>
        </div>
      </div>

      <div className="rsvp-section">
        <div className="rsvp-title">{texts.rsvpTitle}</div>

        <div className="rsvp-field">
          <label>{texts.attendingWith}</label>
          <div className="number-selector">
            <button
              type="button"
              onClick={() => changeCount('adulti', -1)}
              disabled={adulti === 1}
            >
              -
            </button>
            <span>{adulti}</span> {texts.adultsLabel}
            <button type="button" onClick={() => changeCount('adulti', 1)}>
              +
            </button>
          </div>
          <div className="number-selector">
            <button
              type="button"
              onClick={() => changeCount('copii', -1)}
              disabled={copii === 0}
            >
              -
            </button>
            <span>{copii}</span> {texts.childrenLabel}
            <button type="button" onClick={() => changeCount('copii', 1)}>
              +
            </button>
          </div>

          <div id="names-container" className="names-container">
            {/* Dynamic name fields logic can be added here */}
          </div>
        </div>

        <div className="rsvp-field">
          <label>{texts.menuPreference}</label>
          <select id="meniu">
            <option value="meat">{texts.menuMeat}</option>
            <option value="vegetarian">{texts.menuVegetarian}</option>
            <option value="vegan">{texts.menuVegan}</option>
            <option value="mixed">{texts.menuMixed}</option>
          </select>
        </div>

        <div className="rsvp-field">
          <label>{texts.chooseMessage}</label>
          <div className="messages-list">
            <div
              className={`message-option ${selectedMsg === texts.message1 ? 'selected' : ''}`}
              onClick={() => handleMessageClick(texts.message1)}
            >
              {texts.message1}
            </div>
            <div
              className={`message-option ${selectedMsg === texts.message2 ? 'selected' : ''}`}
              onClick={() => handleMessageClick(texts.message2)}
            >
              {texts.message2}
            </div>
            <div
              className={`message-option ${selectedMsg === texts.message3 ? 'selected' : ''}`}
              onClick={() => handleMessageClick(texts.message3)}
            >
              {texts.message3}
            </div>
            <div
              className={`message-option ${selectedMsg === texts.message4 ? 'selected' : ''}`}
              onClick={() => handleMessageClick(texts.message4)}
            >
              {texts.message4}
            </div>
          </div>
        </div>

        <div className="rsvp-field">
          <label>{texts.anythingElse}</label>
          <textarea id="mentiune" rows={3} placeholder={texts.placeholderAnything} />
        </div>

        <div className="buttons">
          <p className="reminder-text">{texts.reminderText}</p>

          <button type="button" onClick={() => sendConfirmation(true)} className="btn btn-accept">
            {texts.confirmBtn}
          </button>
          <button type="button" onClick={() => sendConfirmation(false)} className="btn btn-decline">
            {texts.declineBtn}
          </button>

          {status && (
            <div id="status-container">
              <p className={`status-message ${status === 'vin' ? 'status-vin' : 'status-nu'}`}>
                {status === 'vin' ? texts.thanksVin : texts.thanksNu}
              </p>
              <button type="button" onClick={resetConfirmation} className="change-btn">
                {texts.changeMind}
              </button>
            </div>
          )}
        </div>

        <a
          href="https://www.google.com/calendar/render?action=TEMPLATE&text=Estera+%26+Daniel+Wedding&dates=20280523T090000/20280523T230000&details=Wedding+Invitation!+Location:+Cluj-Napoca&location=Cluj-Napoca"
          target="_blank"
          rel="noopener noreferrer"
          className="btn calendar-btn"
        >
          {texts.addToCalendar}
        </a>

        <div className="location-section">
          <h3 className="location-title">{texts.whereToFindUs}</h3>

          <div className="location-card">
            <div className="venue-icon"><i className="fas fa-building-columns"></i></div>
            <p className="venue-name">{texts.civilCeremony}</p>
            <p className="venue-type">{texts.cityHall}</p>
            <p className="venue-address">{texts.civilAddress}</p>
            <a
              href="https://www.google.com/maps/dir/?api=1&destination=Prim%C4%83ria+Cluj-Napoca%2C+Pia%C8%9Ba+Unirii+1%2C+Cluj-Napoca"
              target="_blank"
              rel="noopener noreferrer"
              className="btn directions-btn"
            >
              {texts.howToGetCivil}
            </a>
            <p className="redirect-note">{texts.redirectNote}</p>
          </div>

          <div className="location-card">
            <div className="venue-icon"><i className="fas fa-church"></i></div>
            <p className="venue-name">{texts.religiousCeremony}</p>
            <p className="venue-type">{texts.stMichaelChurch}</p>
            <p className="venue-address">{texts.churchAddress}</p>
            <a
              href="https://www.google.com/maps/dir/?api=1&destination=Biserica+Sf%C3%A2ntul+Mihail%2C+Pia%C8%9Ba+Unirii%2C+Cluj-Napoca"
              target="_blank"
              rel="noopener noreferrer"
              className="btn directions-btn"
            >
              {texts.howToGetChurch}
            </a>
            <p className="redirect-note">{texts.redirectNote}</p>
          </div>

          <div className="location-card">
            <div className="venue-icon"><i className="fas fa-champagne-glasses"></i></div>
            <p className="venue-name">{texts.reception}</p>
            <p className="venue-type">{texts.hapHap}</p>
            <p className="venue-address">{texts.receptionAddress}</p>
            <a
              href="https://www.google.com/maps/dir/?api=1&destination=Restaurant+Hap+%26+Hap%2C+Memorandumului+8%2C+Cluj-Napoca"
              target="_blank"
              rel="noopener noreferrer"
              className="btn directions-btn"
            >
              {texts.howToGetReception}
            </a>
            <p className="redirect-note">{texts.redirectNote}</p>
          </div>

          <p className="small-note">{texts.allLocationsNote}</p>
        </div>

        <div className="cazare-info">
          <strong>{texts.accommodation}</strong> {texts.accommodationText}
        </div>

        <div className="note">{parse(texts.finalNote)}</div>
      </div>
    </div>
  );
};

export default WeddingInvitation;