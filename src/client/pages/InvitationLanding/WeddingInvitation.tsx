import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import './WeddingInvitation.scss';
import parse from 'html-react-parser';

type InvitationVenues = {
  civil?: {
    name?: string;
    address?: string;
    time?: string;
  };
  religious?: {
    name?: string;
    address?: string;
    time?: string;
  };
  reception?: {
    name?: string;
    address?: string;
    time?: string;
  };
};

type InvitationEvent = {
  eventDate?: string;
  city?: string;
  coupleNames?: string;
  tagline?: string;
  countdownTitle?: string;
  rsvpTitle?: string;
  venues?: InvitationVenues;
  [key: string]: string | InvitationVenues | undefined;
};

type CountdownState = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

const WeddingInvitation = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();

  const [isVerified, setIsVerified] = useState(false);
  const [eventData, setEventData] = useState<InvitationEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [adulti, setAdulti] = useState(1);
  const [copii, setCopii] = useState(0);
  const [selectedMsg, setSelectedMsg] = useState('');
  const [status, setStatus] = useState<'vin' | 'nu' | null>(null);

  const [timeLeft, setTimeLeft] = useState<CountdownState>({
    days: '??',
    hours: '??',
    minutes: '??',
    seconds: '??',
  });

  // Check if guest is verified (runs unconditionally)
  useEffect(() => {
    const verified = searchParams.get('verified') === 'true';
    const token = searchParams.get('token');

    // Prevent infinite redirect loop
    const isOnInvitationPath = window.location.pathname.includes('/invitation');

    if (!verified || !token) {
      if (isOnInvitationPath) {
        window.location.href = `/invitatie/${slug}`;
      }
      return;
    }

    setIsVerified(true);
  }, [slug, searchParams]);

  // Fetch event data from backend
  useEffect(() => {
    if (!slug || !isVerified) return;

    const fetchEvent = async () => {
      try {
        setLoading(true);
        setFetchError(null);

        const response = await fetch(`/api/event/${slug}`); // ← plural "events" to match backend

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${await response.text()}`);
        }

        const json = await response.json();
        setEventData(json.data || json);
      } catch (err: unknown) {
        console.error("Failed to load invitation:", err);
        setFetchError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [slug, isVerified]);

  // Countdown based on real event date
  useEffect(() => {
    if (!eventData?.eventDate || !isVerified) return;

    const weddingDate = new Date(eventData.eventDate);

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

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [eventData?.eventDate, isVerified]);

  // Load saved RSVP status from localStorage
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

  const sendConfirmation = async (accept: boolean) => {
    if (!slug) return;

    const payload = {
      attending: accept,
      adults: adulti,
      children: copii,
      menu: (document.getElementById('meniu') as HTMLSelectElement)?.value || 'not specified',
      chosenMessage: selectedMsg,
      mention: (document.getElementById('mentiune') as HTMLTextAreaElement)?.value.trim(),
    };

    try {
      const res = await fetch(`/api/event/${slug}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to send RSVP");
      }

      localStorage.setItem('rsvpStatus', accept ? 'vin' : 'nu');
      setStatus(accept ? 'vin' : 'nu');
    } catch (err) {
      console.error("RSVP submission failed:", err);
      alert("Could not send your confirmation. Please try again.");
    }
  };

  const resetConfirmation = () => {
    if (window.confirm('Are you sure you want to change your response?')) {
      localStorage.removeItem('rsvpStatus');
      setStatus(null);
      (document.getElementById('mentiune') as HTMLTextAreaElement).value = '';
    }
  };

  // Loading & error states (AFTER all hooks)
  if (!isVerified) {
    return <div>Verifying access...</div>;
  }

  if (loading) {
    return <div className="loading-message">Loading your invitation...</div>;
  }

  if (fetchError || !eventData) {
    return <div className="error-message">Error: {fetchError || "Invitation not found"}</div>;
  }

  // Helper to get values with fallback
  const getText = (key: string, fallback: string): string => {
    const value = eventData?.[key];
    return typeof value === "string" ? value : fallback;
  };

  return (
    <div className="container">
      <div className="header">
        <div className="names">{getText('coupleNames', 'THE COUPLE ♥')}</div>

        <div className="event-date">
          {getText('eventDate', 'DATE TBA')}
          <span>{getText('city', 'Location TBA')}</span>
        </div>

        <p className="tagline">{parse(getText('tagline', 'We warmly invite you to celebrate<br>our love together'))}</p>
      </div>

      <div className="countdown-section">
        <div className="countdown-title">{parse(getText('countdownTitle', '...until we say "I do" there are left'))}</div>
        <div className="timer">
          <div className="unit">
            <div className="number">{timeLeft.days}</div>
            <div className="label">days</div>
          </div>
          <div className="unit">
            <div className="number">{timeLeft.hours}</div>
            <div className="label">hours</div>
          </div>
          <div className="unit">
            <div className="number">{timeLeft.minutes}</div>
            <div className="label">minutes</div>
          </div>
          <div className="unit">
            <div className="number">{timeLeft.seconds}</div>
            <div className="label">seconds</div>
          </div>
        </div>
      </div>

      <div className="rsvp-section">
        <div className="rsvp-title">{getText('rsvpTitle', 'Please confirm your attendance')}</div>

        <div className="rsvp-field">
          <label>{getText('attendingWith', 'Attending with:')}</label>
          <div className="number-selector">
            <button
              type="button"
              onClick={() => changeCount('adulti', -1)}
              disabled={adulti === 1}
            >
              -
            </button>
            <span>{adulti}</span> {getText('adultsLabel', 'adults')}
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
            <span>{copii}</span> {getText('childrenLabel', 'children')}
            <button type="button" onClick={() => changeCount('copii', 1)}>
              +
            </button>
          </div>

          <div id="names-container" className="names-container">
            {/* Dynamic name fields logic can be added here */}
          </div>
        </div>

        <div className="rsvp-field">
          <label>{getText('menuPreference', 'Menu preference (for the group):')}</label>
          <select id="meniu">
            <option value="meat">{getText('menuMeat', 'Meat menu')}</option>
            <option value="vegetarian">{getText('menuVegetarian', 'Vegetarian')}</option>
            <option value="vegan">{getText('menuVegan', 'Vegan')}</option>
            <option value="mixed">{getText('menuMixed', 'Mixed / Doesn\'t matter')}</option>
          </select>
        </div>

        <div className="rsvp-field">
          <label>{getText('chooseMessage', 'Choose a message for us (optional):')}</label>
          <div className="messages-list">
            <div
              className={`message-option ${selectedMsg === getText('message1', '') ? 'selected' : ''}`}
              onClick={() => handleMessageClick(getText('message1', ''))}
            >
              {getText('message1', 'Yes, of course we\'ll be there! Can\'t wait 💋')}
            </div>
            <div
              className={`message-option ${selectedMsg === getText('message2', '') ? 'selected' : ''}`}
              onClick={() => handleMessageClick(getText('message2', ''))}
            >
              {getText('message2', 'Congratulations! We\'re coming with great joy ❤️')}
            </div>
            {/* Add message3, message4 similarly if stored in backend */}
          </div>
        </div>

        <div className="rsvp-field">
          <label>{getText('anythingElse', 'Anything else you\'d like to tell us? (optional)')}</label>
          <textarea id="mentiune" rows={3} placeholder={getText('placeholderAnything', '')} />
        </div>

        <div className="buttons">
          <p className="reminder-text">{getText('reminderText', 'Click the button below → your response will be recorded directly on the site!')}</p>

          <button type="button" onClick={() => sendConfirmation(true)} className="btn btn-accept">
            {getText('confirmBtn', 'I\'ll be there! ✓')}
          </button>
          <button type="button" onClick={() => sendConfirmation(false)} className="btn btn-decline">
            {getText('declineBtn', 'Sorry, I can\'t make it ✗')}
          </button>

          {status && (
            <div id="status-container">
              <p className={`status-message ${status === 'vin' ? 'status-vin' : 'status-nu'}`}>
                {status === 'vin'
                  ? getText('thanksVin', 'Great! You have accepted to come to the wedding. See you there! ♡')
                  : getText('thanksNu', 'We\'re sorry you cannot be with us... we hug you anyway! ❤️')}
              </p>
              <button type="button" onClick={resetConfirmation} className="change-btn">
                {getText('changeMind', 'I\'ve changed my mind?')}
              </button>
            </div>
          )}
        </div>

        <a
          href={`https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(getText('coupleNames', 'Wedding'))}&dates=${eventData?.eventDate ? eventData.eventDate.replace(/-/g, '') + 'T090000' : ''}/${eventData?.eventDate ? eventData.eventDate.replace(/-/g, '') + 'T230000' : ''}&details=Wedding+Invitation!+Location:+${encodeURIComponent(getText('city', 'TBA'))}&location=${encodeURIComponent(getText('city', 'TBA'))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn calendar-btn"
        >
          {getText('addToCalendar', 'Add to Calendar 📅')}
        </a>

        <div className="location-section">
          <h3 className="location-title">{getText('whereToFindUs', 'Where to find us')}</h3>

          {/* Civil Ceremony */}
          {eventData?.venues?.civil && (
            <div className="location-card">
              <div className="venue-icon"><i className="fas fa-building-columns"></i></div>
              <p className="venue-name">{eventData.venues.civil.name || 'Civil Ceremony'}</p>
              <p className="venue-type">{eventData.venues.civil.name || 'City Hall'}</p>
              <p className="venue-address">{eventData.venues.civil.address}</p>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(eventData.venues.civil.address || "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn directions-btn"
              >
                {getText('howToGetCivil', 'How to get to the civil ceremony →')}
              </a>
              <p className="redirect-note">{getText('redirectNote', 'You will be redirected to Google Maps / Maps / Apple Maps depending on your phone')}</p>
            </div>
          )}

          {/* Religious & Reception – similar pattern */}
          {/* ... add conditionally if present in eventData.venues ... */}

          <p className="small-note">{getText('allLocationsNote', 'All locations are in the city center, just a few steps from each other.')}</p>
        </div>

        <div className="cazare-info">
          <strong>{getText('accommodation', 'Accommodation:')}</strong>{' '}
          {getText('accommodationText', 'We recommend hotels in the center...')}
        </div>

        <div className="note">{parse(getText('finalNote', 'Please confirm as soon as possible<br>Your response will be recorded automatically on the site.<br>Thank you from the bottom of our hearts! ♡'))}</div>
      </div>
    </div>
  );
};

export default WeddingInvitation;
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return "Could not load the invitation";
  };
