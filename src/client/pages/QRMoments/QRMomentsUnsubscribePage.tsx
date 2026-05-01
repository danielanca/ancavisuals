import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

type Status = 'loading' | 'success' | 'not-found' | 'error';

export default function QRMomentsUnsubscribePage() {
  const { guestId } = useParams<{ guestId: string }>();
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!guestId) {
      setStatus('not-found');
      return;
    }

    fetch(`/api/qr-moments/unsubscribe/${guestId}`)
      .then(async (response) => {
        if (response.status === 404) {
          setStatus('not-found');
          return;
        }

        const result = await response.json();
        if (result.ok) {
          setStatus('success');
          return;
        }

        setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, [guestId]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <div className="text-4xl">{status === 'success' ? '✉️' : '🔔'}</div>
        {status === 'loading' && <p className="text-neutral-400 text-sm">Se procesează cererea de dezabonare…</p>}
        {status === 'success' && (
          <>
            <h1 className="text-white text-lg font-light">Te-ai dezabonat cu succes</h1>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Nu vei mai primi emailuri când mirii răspund la upload-urile tale.
            </p>
          </>
        )}
        {status === 'not-found' && (
          <>
            <h1 className="text-white text-lg font-light">Link invalid</h1>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Invitatul nu a fost găsit sau link-ul nu mai este valid.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-white text-lg font-light">A apărut o eroare</h1>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Încearcă din nou puțin mai târziu.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
