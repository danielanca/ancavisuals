import React, { useState, useRef, useEffect } from "react";
import type { WeddingTable, WeddingGuest } from "../types";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";

const RSVP_ACCENT_CLASSES = {
  asteptare: "ring-1 ring-inset ring-yellow-400/40",
  confirmat: "ring-1 ring-inset ring-green-400/40",
  refuzat: "ring-1 ring-inset ring-red-400/40",
} as const;

interface TableCardProps {
  table: WeddingTable;
  tableGuests: WeddingGuest[];
  unassignedGuests: WeddingGuest[];
  onAssignGuest: (guestId: string, tableId: string) => void;
  onUnassignGuest: (guestId: string) => void;
  onDeleteTable: (tableId: string) => void;
  onTableUpdated: (table: WeddingTable) => void;
  isDeleting: boolean;
}

const TableCard: React.FC<TableCardProps> = ({
  table,
  tableGuests,
  unassignedGuests,
  onAssignGuest,
  onUnassignGuest,
  onDeleteTable,
  onTableUpdated,
  isDeleting,
}) => {
  const { coupleAuth } = useWeddingHubAuth();
  const [query, setQuery] = useState("");
  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [open, setOpen] = useState(false);
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [tableNameInput, setTableNameInput] = useState(table.tableName);
  const [tableAliasInput, setTableAliasInput] = useState(table.tableAlias ?? "");
  const [tableCapacityInput, setTableCapacityInput] = useState(String(table.capacity));
  const [isSavingTable, setIsSavingTable] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isFull = tableGuests.length >= table.capacity;

  function normalizeSearchValue(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function levenshteinDistance(source: string, target: string): number {
    if (source === target) return 0;
    if (source.length === 0) return target.length;
    if (target.length === 0) return source.length;

    const previousRow = Array.from({ length: target.length + 1 }, (_, index) => index);

    for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
      let previousDiagonal = previousRow[0];
      previousRow[0] = sourceIndex + 1;

      for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
        const temp = previousRow[targetIndex + 1];
        const cost = source[sourceIndex] === target[targetIndex] ? 0 : 1;

        previousRow[targetIndex + 1] = Math.min(
          previousRow[targetIndex + 1] + 1,
          previousRow[targetIndex] + 1,
          previousDiagonal + cost,
        );

        previousDiagonal = temp;
      }
    }

    return previousRow[target.length];
  }

  function similarityScore(source: string, target: string): number {
    if (!source || !target) return 0;
    const maxLength = Math.max(source.length, target.length);
    if (maxLength === 0) return 1;
    return 1 - (levenshteinDistance(source, target) / maxLength);
  }

  function getGuestSearchTerms(guest: WeddingGuest): string[] {
    return [
      `${guest.firstName} ${guest.lastName}`,
      guest.phone,
      guest.email,
      guest.notes,
      ...(guest.accompanyingAdultNames ?? []),
      ...(guest.childrenNames ?? []),
    ].filter((value): value is string => Boolean(value && value.trim()));
  }

  function getGuestFamilySummary(guest: WeddingGuest): string | null {
    const familyMembers = [
      ...(guest.accompanyingAdultNames ?? []).map((name) => name.trim()).filter(Boolean),
      ...(guest.childrenNames ?? []).map((name) => name.trim()).filter(Boolean),
    ];

    if (familyMembers.length === 0) return guest.sameTableWithFamily ? "Vrea să stea împreună cu familia" : null;

    const preview = familyMembers.slice(0, 3).join(", ");
    const suffix = familyMembers.length > 3 ? ` +${familyMembers.length - 3}` : "";
    return `${preview}${suffix}`;
  }

  function guestMatchesQuery(guest: WeddingGuest, rawQuery: string): boolean {
    const normalizedQuery = normalizeSearchValue(rawQuery);
    if (!normalizedQuery) return true;

    const searchableTerms = getGuestSearchTerms(guest).map(normalizeSearchValue).filter(Boolean);

    return searchableTerms.some((term) => {
      const compactQuery = normalizedQuery.replace(/\s+/g, "");
      const compactTerm = term.replace(/\s+/g, "");
      const queryTerms = normalizedQuery.split(" ").filter(Boolean);
      const termTokens = term.split(" ").filter(Boolean);

      if (
        term.includes(normalizedQuery) ||
        compactTerm.includes(compactQuery) ||
        normalizedQuery.includes(term) ||
        compactQuery.includes(compactTerm)
      ) {
        return true;
      }

      if (
        queryTerms.length > 1 &&
        queryTerms.every((queryTerm) =>
          termTokens.some((termToken) =>
            termToken.includes(queryTerm) ||
            queryTerm.includes(termToken) ||
            similarityScore(queryTerm, termToken) >= 0.72,
          ),
        )
      ) {
        return true;
      }

      return similarityScore(compactQuery, compactTerm) >= 0.72;
    });
  }

  function guestMatchScore(guest: WeddingGuest, rawQuery: string): number {
    const normalizedQuery = normalizeSearchValue(rawQuery);
    if (!normalizedQuery) return 0;

    const compactQuery = normalizedQuery.replace(/\s+/g, "");
    const searchableTerms = getGuestSearchTerms(guest).map(normalizeSearchValue).filter(Boolean);
    const queryTerms = normalizedQuery.split(" ").filter(Boolean);

    let score = 0;

    for (const term of searchableTerms) {
      const compactTerm = term.replace(/\s+/g, "");
      const termTokens = term.split(" ").filter(Boolean);

      if (term === normalizedQuery) {
        score = Math.max(score, 1);
      }

      if (term.startsWith(normalizedQuery)) {
        score = Math.max(score, 0.98);
      }

      if (term.includes(normalizedQuery)) {
        score = Math.max(score, 0.94);
      }

      if (compactTerm === compactQuery) {
        score = Math.max(score, 0.92);
      }

      if (compactTerm.startsWith(compactQuery)) {
        score = Math.max(score, 0.9);
      }

      if (compactTerm.includes(compactQuery)) {
        score = Math.max(score, 0.86);
      }

      if (queryTerms.length > 1) {
        const termScore = queryTerms.reduce((total, queryTerm) => {
          const bestTermScore = termTokens.reduce((best, termToken) => {
            if (termToken === queryTerm) return Math.max(best, 1);
            if (termToken.startsWith(queryTerm) || queryTerm.startsWith(termToken)) return Math.max(best, 0.95);
            if (termToken.includes(queryTerm) || queryTerm.includes(termToken)) return Math.max(best, 0.9);
            return Math.max(best, similarityScore(queryTerm, termToken));
          }, 0);
          return total + bestTermScore;
        }, 0) / queryTerms.length;

        score = Math.max(score, termScore);
      }

      score = Math.max(score, similarityScore(compactQuery, compactTerm));
    }

    return score;
  }

  const suggestions = query.trim().length === 0
    ? unassignedGuests
    : unassignedGuests
      .filter((guest) => guestMatchesQuery(guest, query))
      .sort((first, second) => {
        const secondScore = guestMatchScore(second, query);
        const firstScore = guestMatchScore(first, query);
        if (secondScore !== firstScore) return secondScore - firstScore;

        const firstNameA = `${first.firstName} ${first.lastName}`.localeCompare(`${second.firstName} ${second.lastName}`, "ro-RO");
        return firstNameA;
      });

  const selectedGuest = unassignedGuests.find((g) => g.id === selectedGuestId) ?? null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (guest: WeddingGuest) => {
    setSelectedGuestId(guest.id);
    setQuery(`${guest.firstName} ${guest.lastName}`);
    setOpen(false);
  };

  const handleAssign = () => {
    if (!selectedGuestId) return;
    onAssignGuest(selectedGuestId, table.id);
    setSelectedGuestId("");
    setQuery("");
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedGuestId("");
    setOpen(true);
  };

  useEffect(() => {
    setTableNameInput(table.tableName);
    setTableAliasInput(table.tableAlias ?? "");
    setTableCapacityInput(String(table.capacity));
  }, [table.tableName, table.tableAlias, table.capacity]);

  const handleSaveTable = async () => {
    const normalizedName = tableNameInput.trim();
    const normalizedAlias = tableAliasInput.trim();
    const normalizedCapacity = Math.min(50, Math.max(1, Number(tableCapacityInput) || table.capacity));

    if (!normalizedName) {
      setTableError("Numele mesei este obligatoriu.");
      return;
    }

    if (
      normalizedName === table.tableName &&
      normalizedAlias === (table.tableAlias ?? "") &&
      normalizedCapacity === table.capacity
    ) {
      setIsEditingTable(false);
      setTableNameInput(table.tableName);
      setTableAliasInput(table.tableAlias ?? "");
      setTableCapacityInput(String(table.capacity));
      setTableError(null);
      return;
    }

    setIsSavingTable(true);
    setTableError(null);

    try {
      const response = await fetch(`/api/wedding-hub/tables/${table.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({
          tableName: normalizedName,
          tableAlias: normalizedAlias,
          capacity: normalizedCapacity,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error ?? "Nu s-a putut actualiza masa.");
      }

      const updatedTable = await response.json() as WeddingTable;
      onTableUpdated(updatedTable);
      setIsEditingTable(false);
      setTableAliasInput(updatedTable.tableAlias ?? "");
      setTableCapacityInput(String(updatedTable.capacity));
    } catch (error: unknown) {
      setTableError((error as Error).message);
    } finally {
      setIsSavingTable(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          {isEditingTable ? (
            <div className="space-y-2">
              <input
                type="text"
                value={tableNameInput}
                onChange={(e) => setTableNameInput(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
                placeholder="Denumirea mesei"
              />
              <input
                type="text"
                value={tableAliasInput}
                onChange={(e) => setTableAliasInput(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
                placeholder="Pseudonim (ex: BFF Mire, Bunicii)"
              />
              <input
                type="number"
                min={1}
                max={50}
                value={tableCapacityInput}
                onChange={(e) => setTableCapacityInput(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
                placeholder="Locuri masă"
                aria-label="Locuri masă"
                title="Locuri masă"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveTable}
                  disabled={isSavingTable || !tableNameInput.trim()}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-rose-500 disabled:opacity-40"
                >
                  {isSavingTable ? "..." : "Salvează"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingTable(false);
                    setTableNameInput(table.tableName);
                    setTableError(null);
                  }}
                  className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:text-white"
                >
                  Renunță
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-medium">{table.tableName}</h3>
                <button
                  type="button"
                  onClick={() => setIsEditingTable(true)}
                  className="text-xs text-neutral-500 transition-colors hover:text-white"
                >
                  Editează
                </button>
              </div>
              {table.tableAlias && (
                <p className="text-xs text-rose-300/80">
                  {table.tableAlias}
                </p>
              )}
            </div>
          )}
          <p className="text-neutral-500 text-xs mt-0.5">
            {tableGuests.length} / {table.capacity} locuri
          </p>
          {tableError && (
            <p className="text-red-400 text-xs mt-1">{tableError}</p>
          )}
        </div>
        <button
          onClick={() => onDeleteTable(table.id)}
          disabled={isDeleting}
          className="text-neutral-600 hover:text-red-400 text-xs transition-colors disabled:opacity-50"
        >
          {isDeleting ? "..." : "Șterge"}
        </button>
      </div>

      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isFull ? "bg-rose-500" : "bg-green-500"}`}
          style={{ width: `${Math.min((tableGuests.length / table.capacity) * 100, 100)}%` }}
        />
      </div>

      {tableGuests.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tableGuests.map((guest) => (
            <span
              key={guest.id}
              className={`flex items-center gap-1 bg-neutral-800 text-neutral-300 text-xs px-2 py-1 rounded-full ${RSVP_ACCENT_CLASSES[guest.rsvpStatus]}`}
            >
              {guest.firstName} {guest.lastName}
              <button
                onClick={() => onUnassignGuest(guest.id)}
                className="text-neutral-500 hover:text-red-400 ml-0.5 transition-colors"
                title="Scoate de la masă"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {!isFull && unassignedGuests.length > 0 && (
        <div className="flex gap-2 mt-1" ref={containerRef}>
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder="Caută invitat..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-rose-500 transition-colors placeholder:text-neutral-500"
            />
            {open && suggestions.length > 0 && (
              <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((guest) => (
                  <li key={guest.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(guest); }}
                      className={`w-full text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors flex items-center justify-between gap-3 ${RSVP_ACCENT_CLASSES[guest.rsvpStatus]}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{guest.firstName} {guest.lastName}</span>
                        {getGuestFamilySummary(guest) && (
                          <span className="block truncate text-[11px] text-neutral-500 mt-0.5">
                            {guest.sameTableWithFamily ? "Familie · " : ""}
                            {getGuestFamilySummary(guest)}
                          </span>
                        )}
                      </span>
                      {guest.rsvpStatus !== "confirmat" && (
                        <span className="text-neutral-500 ml-2 shrink-0">({guest.rsvpStatus})</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={handleAssign}
            disabled={!selectedGuest}
            className="bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0"
          >
            Adaugă
          </button>
        </div>
      )}

      {isFull && (
        <p className="text-rose-400 text-xs text-center">Masa este plină</p>
      )}

      <div className="border-t border-neutral-800 pt-3">
        <p className="text-[11px] text-neutral-600 mb-2">
          Dacă ștergi masa, invitații din ea vor rămâne fără masă alocată.
        </p>
        <button
          type="button"
          onClick={() => onDeleteTable(table.id)}
          disabled={isDeleting}
          className="w-full rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-300 transition-colors hover:bg-red-950/30 hover:text-red-200 disabled:opacity-40"
        >
          {isDeleting ? "Se șterge..." : "Șterge masa"}
        </button>
      </div>
    </div>
  );
};

export default TableCard;
