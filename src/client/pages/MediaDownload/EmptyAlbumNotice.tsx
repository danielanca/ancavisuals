const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

/** "12septembrie2026": an album link in the usual form (day + month in words + year). */
export function isAlbumDateSlug(slug: string): boolean {
  return new RegExp(`^\\d{1,2}(${MONTHS.join("|")})\\d{4}$`, "i").test(slug);
}

const EXAMPLES = ["12septembrie2026", "3mai2026", "25octombrie2025"];

/**
 * An album with nothing in it yet (owner, 2026-10-28): no consent pop-up, no "take a screenshot
 * and send it to us" — just what most likely happened: the photos are not uploaded yet, or the
 * link is wrong. Square and monochrome like the rest of the album page.
 */
export default function EmptyAlbumNotice({ slug }: { slug: string }) {
  const looksRight = isAlbumDateSlug(slug);
  return (
    <main className="flex min-h-[calc(var(--stable-vh,1vh)*100)] items-center justify-center bg-neutral-950 px-4 py-12 text-white">
      <div className="w-full max-w-md border border-white/15 px-6 py-10 text-center sm:px-10">
        <a href="/" className="mb-8 block no-underline" aria-label="AncaVisuals — pagina principală">
          <span className="text-lg uppercase tracking-[0.3em]">
            <span className="font-bold text-white">Anca</span>
            <span className="font-light text-neutral-300">Visuals</span>
          </span>
        </a>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Album gol</p>
        <h1 className="mt-3 text-2xl font-light leading-snug">
          {looksRight ? "Pozele nu au fost încărcate încă" : "Pozele nu au fost încărcate încă sau linkul este greșit"}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">
          {looksRight
            ? "Linkul este corect, dar în album nu sunt încă fotografii sau filme. Reveniți puțin mai târziu: le punem aici imediat ce sunt gata."
            : "În acest album nu sunt fotografii sau filme. Verificați încă o dată linkul primit de la noi."}
        </p>

        <div className="mt-8 border-t border-white/10 pt-6 text-left">
          <p className="text-sm leading-relaxed text-neutral-300">
            Linkurile albumelor arată așa: <span className="whitespace-nowrap font-medium text-white">ancavisuals.ro/media/</span> + ziua + luna în cuvinte + anul. De exemplu:
          </p>
          <ul className="mt-3 space-y-1.5 font-mono text-[13px] text-neutral-200">
            {EXAMPLES.map((example) => (
              <li key={example}>ancavisuals.ro/media/{example}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400">
            Dacă linkul vostru arată la fel, cel mai probabil pozele nu au fost încărcate încă.
          </p>
        </div>

        <p className="mt-8 font-mono text-[11px] text-neutral-600">ancavisuals.ro/media/{slug}</p>
      </div>
    </main>
  );
}
