import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useAuth from '../auth/useAuth';
import Breadcrumb from './Breadcrumb';
import type { QrParticipant } from '../../../../shared/qrMoments/participants';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const dateTimeFormat = new Intl.DateTimeFormat('ro-RO', {
  timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dateTimeFormat.format(date) : '—';
}

export default function QrParticipantsPage() {
  const { auth } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [participants, setParticipants] = useState<QrParticipant[]>([]);
  const [event, setEvent] = useState('');
  const [contributorsOnly, setContributorsOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!auth.accessToken) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch('/api/qr-moments/admin/participants', {
      headers: { Authorization: `Bearer ${auth.accessToken}` }, signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('Nu am putut încărca participanții.');
      const data = await response.json();
      if (!Array.isArray(data.participants)) throw new Error('Răspuns invalid.');
      if (!controller.signal.aborted) setParticipants(data.participants);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Nu am putut încărca participanții. Încearcă din nou.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [auth.accessToken, revision]);

  const events = useMemo(() => [...new Map(participants.map(person => [person.eventSlug, person.eventLabel])).entries()], [participants]);
  const filtered = useMemo(() => {
    const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
    return participants.filter(person => (!contributorsOnly || person.uploadCount > 0) && (!event || person.eventSlug === event) &&
      tokens.every(token => normalize([person.name, person.email, person.eventLabel, person.eventSlug, ...person.albumSlugs].join(' ')).includes(token)));
  }, [participants, query, event, contributorsOnly]);
  useEffect(() => setPage(0), [query, event, contributorsOnly, revision]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, pageCount - 1);
  const fieldClass = 'rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white';

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <Breadcrumb />
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div>
          <h1 className="text-white text-2xl font-light">Participanți QR Moments</h1>
          <p className="text-neutral-400 text-sm mt-2">Nume, emailuri și albumele la care au contribuit. Aceeași persoană poate apărea la mai multe evenimente.</p>
        </div>
        <button className={fieldClass} disabled={loading} onClick={() => setRevision(value => value + 1)}>Reîncarcă</button>
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <input aria-label="Caută participanți" placeholder="Nume, email sau album..." className={`${fieldClass} flex-1 min-w-0`} value={query} onChange={e => {
          const next = new URLSearchParams(params);
          if (e.target.value) next.set('q', e.target.value); else next.delete('q');
          setParams(next, { replace: true });
        }} />
        <select aria-label="Eveniment" className={`${fieldClass} max-w-full`} value={event} onChange={e => setEvent(e.target.value)}>
          <option value="">Toate evenimentele</option>
          {events.map(([slug, label]) => <option key={slug} value={slug}>{label} · {slug}</option>)}
        </select>
        <label className="text-neutral-300 text-sm flex gap-2 items-center"><input type="checkbox" checked={contributorsOnly} onChange={e => setContributorsOnly(e.target.checked)} />Doar cu materiale încărcate</label>
      </div>
      {loading ? <p role="status" className="text-neutral-400">Se încarcă participanții…</p> : error ? (
        <div role="alert" className="text-red-400">{error} <button className="underline" onClick={() => setRevision(value => value + 1)}>Reîncearcă</button></div>
      ) : <>
        <p className="text-neutral-400 text-sm">{filtered.length} înregistrări · {new Set(filtered.map(person => person.email || person.id)).size} contacte distincte</p>
        {!filtered.length ? <p className="text-neutral-500">Nu există participanți pentru filtrele selectate.</p> : (
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-900 text-neutral-400"><tr>{['Participant', 'Eveniment / album', 'Materiale', 'Notificări email', 'Înscriere', 'Prima încărcare', 'Ultima încărcare'].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-neutral-800">
                {filtered.slice(currentPage * 50, (currentPage + 1) * 50).map(person => <tr key={person.id}>
                  <td className="px-4 py-3"><p className="text-white">{person.name}</p><p className="text-neutral-400 break-all">{person.email || 'Fără email'}</p></td>
                  <td className="px-4 py-3"><p className="text-white">{person.eventLabel}</p><p className="text-neutral-500 break-all">QR: {person.eventSlug}</p>{person.albumSlugs.length ? person.albumSlugs.map(slug => <Link key={slug} to={`/media/${encodeURIComponent(slug)}`} className="block text-amber-300 break-all">Album: {slug}</Link>) : <p className="text-neutral-500">Album neconfigurat</p>}</td>
                  <td className="px-4 py-3 text-white">{person.uploadCount}</td>
                  <td className="px-4 py-3 text-neutral-300">{person.emailConsent ? 'Acord activ' : 'Fără acord / dezabonat'}</td>
                  <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">{formatDateTime(person.createdAt)}</td>
                  <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">{formatDateTime(person.firstUploadAt)}</td>
                  <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">{formatDateTime(person.lastUploadAt)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-neutral-500 text-xs">Orele sunt afișate în fusul orar al României. Încărcările se referă la materialele existente; — indică o dată indisponibilă.</p>
        {pageCount > 1 && <div className="flex items-center gap-3 text-neutral-400 text-sm"><button className={fieldClass} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Înapoi</button><span>Pagina {currentPage + 1} din {pageCount}</span><button className={fieldClass} disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Înainte</button></div>}
      </>}
    </div>
  );
}
