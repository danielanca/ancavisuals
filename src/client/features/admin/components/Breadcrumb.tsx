import React from "react";
import { Link, useLocation } from "react-router-dom";

const LABELS: Record<string, string> = {
  admin: "Dashboard",
  calendar: "Calendar",
  "bank-details": "Detalii bancare",
  "create-event": "Eveniment nou",
  "create-event-wedding": "Invitație nuntă",
};

export default function Breadcrumb() {
  const { pathname } = useLocation();

  const segments = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  // segments for /admin/calendar → ["admin", "calendar"]

  const crumbs = segments.map((seg, i) => {
    const path = "/" + segments.slice(0, i + 1).join("/");
    const label = LABELS[seg] ?? seg;
    const isLast = i === segments.length - 1;
    return { path, label, isLast };
  });

  if (crumbs.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-neutral-500 mb-6">
      {crumbs.map(({ path, label, isLast }) => (
        <React.Fragment key={path}>
          {isLast ? (
            <span className="text-neutral-300 font-medium">{label}</span>
          ) : (
            <Link to={path} className="hover:text-neutral-300 transition-colors">
              {label}
            </Link>
          )}
          {!isLast && <span className="text-neutral-700">›</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}
