import React, { useEffect, useState } from "react";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import AncaLoader from "../../../components/UI/AncaLoader";

interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
  createdAt: string;
  lastSignIn: string;
}

interface CollaboratorInvitation {
  id: string;
  email: string;
  albumSlug: string;
  albumUrl: string;
  inviteInstagram: boolean;
  inviteModeration: boolean;
  status: "active" | "completed" | "cancelled";
  reminderCount: number;
  createdByEmail: string;
  createdAt: string | null;
  updatedAt: string | null;
  lastSentAt: string | null;
  nextReminderAt: string | null;
  completedAt: string | null;
  completedActionType: "instagram" | "moderation" | null;
  completedByEmail: string | null;
}

const SUPREME_ADMIN_EMAIL = "ancadaniel1994@gmail.com";

const inputClass =
  "w-full bg-neutral-800 text-white text-sm placeholder-neutral-600 border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-violet-500 transition-colors";

export default function AccountsPage() {
  const { auth } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [invitations, setInvitations] = useState<CollaboratorInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteAlbumSlug, setInviteAlbumSlug] = useState("");
  const [inviteInstagram, setInviteInstagram] = useState(true);
  const [inviteModeration, setInviteModeration] = useState(true);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/admin/accounts", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setUsers(data.users ?? []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));

    fetch("/api/admin/account-invitations", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setInvitations(data.invitations ?? []);
      })
      .catch(() => {});
  }, [auth.accessToken]);

  const openEdit = (user: AdminUser) => {
    setEditingUid(user.uid);
    setEditEmail(user.email);
    setEditPassword("");
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!editingUid) return;
    if (!editEmail.trim() && !editPassword.trim()) {
      setSaveError("Completează cel puțin emailul sau parola.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const body: Record<string, string> = {};
    if (editEmail.trim()) body.email = editEmail.trim();
    if (editPassword.trim()) body.password = editPassword.trim();

    const res = await fetch(`/api/admin/accounts/${editingUid}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setSaveError(data.error ?? "Eroare."); return; }
    setUsers((prev) =>
      prev.map((u) => (u.uid === editingUid ? { ...u, email: editEmail.trim() || u.email } : u))
    );
    setSaveSuccess(true);
    setTimeout(() => { setEditingUid(null); setSaveSuccess(false); }, 800);
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("ro-RO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteAlbumSlug.trim()) {
      setInviteError("Alege un cont și completează albumul.");
      return;
    }
    if (!inviteInstagram && !inviteModeration) {
      setInviteError("Alege cel puțin un tip de review.");
      return;
    }

    setInviteSending(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const response = await fetch("/api/admin/account-invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          albumSlug: inviteAlbumSlug.trim(),
          inviteInstagram,
          inviteModeration,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setInviteError(data.error ?? "Invitația nu a putut fi trimisă.");
        return;
      }

      const invitationResponse = await fetch("/api/admin/account-invitations", {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const invitationData = await invitationResponse.json();
      setInvitations(invitationData.invitations ?? []);
      setInviteSuccess("Invitația a fost trimisă. Reminder-ele vor continua automat per album până la prima acțiune.");
      setInviteAlbumSlug("");
    } catch {
      setInviteError("Invitația nu a putut fi trimisă.");
    } finally {
      setInviteSending(false);
    }
  };

  if (loading) return <AncaLoader />;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <Breadcrumb />

        <div>
          <h1 className="text-white text-2xl font-light tracking-tight">Conturi</h1>
          <p className="text-neutral-500 text-sm mt-1">{users.length} conturi Firebase Auth</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4 space-y-4">
          <div>
            <h2 className="text-white text-lg font-medium">Invitație colaborator per album</h2>
            <p className="text-neutral-500 text-sm mt-1">
              Reminder-ele pleacă automat la 24h, apoi după încă 72h, apoi la 7 zile, 14 zile și 30 zile. Se opresc după prima acțiune în albumul respectiv.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">Cont colaborator</label>
              <select
                className={inputClass}
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              >
                <option value="">Alege un cont</option>
                {users.map((user) => (
                  <option key={user.uid} value={user.email}>
                    {user.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">Album slug</label>
              <input
                className={inputClass}
                value={inviteAlbumSlug}
                onChange={(event) => setInviteAlbumSlug(event.target.value)}
                placeholder="ex: nunta-maria-ion-2026"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input type="checkbox" checked={inviteInstagram} onChange={() => setInviteInstagram((prev) => !prev)} />
              Instagram / Media Assets
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input type="checkbox" checked={inviteModeration} onChange={() => setInviteModeration((prev) => !prev)} />
              Propuneri pentru ștergere
            </label>
          </div>

          {inviteError && <p className="text-red-400 text-sm">{inviteError}</p>}
          {inviteSuccess && <p className="text-emerald-400 text-sm">{inviteSuccess}</p>}

          <div className="flex justify-end">
            <button
              onClick={handleInvite}
              disabled={inviteSending}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
            >
              {inviteSending ? "Se trimite..." : "Trimite invitația"}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
        )}

        <div className="space-y-3">
          <div>
            <h2 className="text-white text-lg font-medium">Invitații trimise</h2>
            <p className="text-neutral-500 text-sm mt-1">{invitations.length} invitații per album</p>
          </div>

          {invitations.length === 0 ? (
            <p className="text-neutral-600 text-sm">Nu există invitații trimise încă.</p>
          ) : invitations.map((invite) => (
            <div key={invite.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white text-sm font-medium">{invite.email}</p>
                  <p className="text-neutral-500 text-xs mt-1">
                    Album: <span className="text-neutral-300">{invite.albumSlug}</span>
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  invite.status === "completed"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}>
                  {invite.status === "completed" ? "Completată" : "Activă"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {invite.inviteInstagram && <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-xs">Instagram / Media Assets</span>}
                {invite.inviteModeration && <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 text-xs">Ștergere / moderare</span>}
              </div>

              <p className="text-neutral-500 text-xs">
                Trimis: {formatDateTime(invite.lastSentAt)} · Reminder-e trimise: {invite.reminderCount}
              </p>
              <p className="text-neutral-500 text-xs">
                Următorul reminder: {invite.nextReminderAt ? formatDateTime(invite.nextReminderAt) : "nu mai sunt programate"}
              </p>
              {invite.completedAt && (
                <p className="text-emerald-400 text-xs">
                  Finalizat la {formatDateTime(invite.completedAt)} prin {invite.completedActionType === "moderation" ? "propunere de ștergere" : "propunere Instagram / Media Assets"}.
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {users.map((user) => {
            const isSupreme = user.email === SUPREME_ADMIN_EMAIL;
            const role = isSupreme ? "Admin" : "Moderator";
            const roleColor = isSupreme ? "bg-violet-500/20 text-violet-300" : "bg-blue-500/20 text-blue-300";

            return (
              <div key={user.uid} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium truncate">{user.email}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColor}`}>{role}</span>
                      {user.disabled && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">Dezactivat</span>
                      )}
                    </div>
                    <p className="text-neutral-600 text-xs mt-1">
                      Creat {formatDate(user.createdAt)} · Ultima autentificare {formatDate(user.lastSignIn)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setInviteEmail(user.email);
                      openEdit(user);
                    }}
                    className="shrink-0 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Editează
                  </button>
                </div>

                {editingUid === user.uid && (
                  <div className="border-t border-neutral-800 pt-3 space-y-3">
                    <div>
                      <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">Email nou</label>
                      <input
                        className={inputClass}
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="email@exemplu.com"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 text-xs font-medium mb-1 uppercase tracking-wide">Parolă nouă</label>
                      <input
                        className={inputClass}
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Lasă gol pentru a nu modifica"
                        autoComplete="new-password"
                      />
                    </div>
                    {saveError && (
                      <p className="text-red-400 text-xs">{saveError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingUid(null)}
                        className="flex-1 py-2 rounded-lg border border-neutral-700 text-neutral-400 text-sm hover:border-neutral-500 transition-colors"
                      >
                        Anulează
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors"
                      >
                        {saveSuccess ? "Salvat ✓" : saving ? "Se salvează..." : "Salvează"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
