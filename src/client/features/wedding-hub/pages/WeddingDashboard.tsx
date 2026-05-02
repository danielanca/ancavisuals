import React, { useMemo } from "react";
import { useWeddingHub } from "../context/WeddingHubContext";
import Loader from "../../../components/UI/Loader";

function formatWeddingDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function daysUntilWedding(dateString: string): number {
  const weddingDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  weddingDate.setHours(0, 0, 0, 0);
  return Math.ceil((weddingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const WeddingDashboard: React.FC = () => {
  const { state } = useWeddingHub();
  const { weddingProfile, guests, tables, loadingProfile } = state;

  const stats = useMemo(() => {
    const confirmedGuests = guests.filter((guest) => guest.rsvpStatus === "confirmat");
    const declinedGuests = guests.filter((guest) => guest.rsvpStatus === "refuzat");
    const pendingGuests = guests.filter((guest) => guest.rsvpStatus === "asteptare");
    const assignedGuests = guests.filter((guest) => guest.tableId !== null);
    const totalAdults = confirmedGuests.reduce((sum, guest) => sum + (guest.adultsCount ?? 1), 0);
    const totalChildren = confirmedGuests.reduce((sum, guest) => sum + (guest.childrenCount ?? 0), 0);

    return {
      totalGuests: guests.length,
      confirmedCount: confirmedGuests.length,
      declinedCount: declinedGuests.length,
      pendingCount: pendingGuests.length,
      assignedCount: assignedGuests.length,
      tablesCount: tables.length,
      totalAdults,
      totalChildren,
    };
  }, [guests, tables]);

  if (loadingProfile) return <Loader variant="fullscreen" />;

  if (!weddingProfile) {
    return (
      <div className="text-center py-16 text-neutral-500">
        Nu s-a putut încărca profilul nunții.
      </div>
    );
  }

  const daysLeft = daysUntilWedding(weddingProfile.weddingDate);

  return (
    <div className="space-y-8">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-light text-white">
              {weddingProfile.brideFirstName}{" "}
              <span className="text-rose-400">&</span>{" "}
              {weddingProfile.groomFirstName}
            </h1>
            <p className="text-neutral-400 mt-1">
              {formatWeddingDate(weddingProfile.weddingDate)}
              {weddingProfile.city && ` · ${weddingProfile.city}`}
            </p>
          </div>
          {daysLeft >= 0 && (
            <div className="text-center sm:text-right">
              <p className="text-3xl font-light text-rose-400">{daysLeft}</p>
              <p className="text-neutral-500 text-xs uppercase tracking-wide">
                {daysLeft === 1 ? "zi rămasă" : "zile rămase"}
              </p>
            </div>
          )}
          {daysLeft < 0 && (
            <div className="bg-rose-900/20 border border-rose-800/30 text-rose-300 text-sm px-4 py-2 rounded-lg">
              Eveniment finalizat
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total invitați" value={stats.totalGuests} color="neutral" />
        <StatCard label="Confirmați" value={stats.confirmedCount} color="green" />
        <StatCard label="Refuzați" value={stats.declinedCount} color="red" />
        <StatCard label="În așteptare" value={stats.pendingCount} color="yellow" />
      </div>

      {stats.confirmedCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Adulți confirmați" value={stats.totalAdults} color="neutral" />
          <StatCard label="Copii confirmați" value={stats.totalChildren} color="neutral" />
          <StatCard label="Mese create" value={stats.tablesCount} color="neutral" />
        </div>
      )}

      {stats.totalGuests > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-neutral-300 mb-4">Progres RSVP</h2>
          <div className="space-y-3">
            <ProgressBar
              label="Confirmați"
              count={stats.confirmedCount}
              total={stats.totalGuests}
              colorClass="bg-green-500"
            />
            <ProgressBar
              label="Refuzați"
              count={stats.declinedCount}
              total={stats.totalGuests}
              colorClass="bg-red-500"
            />
            <ProgressBar
              label="În așteptare"
              count={stats.pendingCount}
              total={stats.totalGuests}
              colorClass="bg-yellow-500"
            />
          </div>
        </div>
      )}

      {stats.tablesCount > 0 && stats.confirmedCount > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-neutral-300 mb-2">Plan de mese</h2>
          <p className="text-neutral-400 text-sm">
            {stats.assignedCount} din {stats.confirmedCount} invitați confirmați au masă alocată.
          </p>
          {stats.assignedCount < stats.confirmedCount && (
            <p className="text-yellow-400 text-xs mt-1">
              {stats.confirmedCount - stats.assignedCount} invitați confirmați nu au încă masă.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "neutral" | "green" | "red" | "yellow";
}) {
  const colorMap = {
    neutral: "text-white",
    green: "text-green-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <p className={`text-2xl font-light ${colorMap[color]}`}>{value}</p>
      <p className="text-neutral-500 text-xs mt-1">{label}</p>
    </div>
  );
}

function ProgressBar({
  label,
  count,
  total,
  colorClass,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between text-xs text-neutral-400 mb-1">
        <span>{label}</span>
        <span>{count} ({percentage}%)</span>
      </div>
      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default WeddingDashboard;
