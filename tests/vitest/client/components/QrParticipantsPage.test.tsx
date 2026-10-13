import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QrParticipantsPage from 'src/client/features/admin/components/QrParticipantsPage';
import DashboardSearch from 'src/client/features/admin/components/DashboardSearch';

vi.mock('src/client/features/admin/auth/useAuth', () => ({ default: () => ({ auth: { accessToken: 'admin-token' } }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const participants = [
  { id: '1', name: 'Mária', email: 'maria@example.com', eventSlug: 'qr-ana', eventLabel: 'Ana & Dan', albumSlugs: ['album-real'], uploadCount: 2, emailConsent: false, createdAt: '2026-10-10T08:00:00Z', firstUploadAt: '2026-10-10T08:20:00Z', lastUploadAt: '2026-10-13T20:15:00Z' },
  { id: '2', name: 'Ioana', email: '', eventSlug: 'qr-other', eventLabel: 'Echipa', albumSlugs: ['other'], uploadCount: 0, emailConsent: true, createdAt: null },
];

test('shows contributors, their actual album and consent; searches without accents and filters events', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ participants }) });
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter><QrParticipantsPage /></MemoryRouter>);
  expect(await screen.findByText('Mária')).toBeInTheDocument();
  expect(screen.queryByText('Ioana')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Album: album-real' })).toHaveAttribute('href', '/media/album-real');
  expect(screen.getByText('Fără acord / dezabonat')).toBeInTheDocument();
  const row = within(screen.getByText('Mária').closest('tr')!);
  expect(row.getByText(/10\.10\.2026.*11:00/)).toBeInTheDocument();
  expect(row.getByText(/10\.10\.2026.*11:20/)).toBeInTheDocument();
  expect(row.getByText(/13\.10\.2026.*23:15/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/qr-moments/admin/participants', expect.objectContaining({ headers: { Authorization: 'Bearer admin-token' } }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'maria album-real' } });
  expect(screen.getByText('Mária')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByText('Ioana')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'qr-other' } });
  expect(screen.queryByText('Mária')).not.toBeInTheDocument();
  expect(screen.getByText('Fără email')).toBeInTheDocument();
  expect(within(screen.getByText('Ioana').closest('tr')!).getAllByText('—')).toHaveLength(3);
});

test('shows failure and supports retry', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ participants: [] }) });
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter><QrParticipantsPage /></MemoryRouter>);
  const alert = await screen.findByRole('alert');
  fireEvent.click(within(alert).getByRole('button', { name: 'Reîncearcă' }));
  expect(await screen.findByText('Nu există participanți pentru filtrele selectate.')).toBeInTheDocument();
});

test('dashboard search finds and opens the participant database', async () => {
  render(<MemoryRouter><Routes><Route path="/" element={<DashboardSearch />} /><Route path="/admin/qr-participants" element={<p>Lista participanților</p>} /></Routes></MemoryRouter>);
  const input = screen.getByRole('textbox');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'baza de date' } });
  fireEvent.mouseDown(await screen.findByText('Participanți QR Moments'));
  expect(await screen.findByText('Lista participanților')).toBeInTheDocument();
});
