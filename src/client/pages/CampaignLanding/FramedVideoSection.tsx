/*
 * Purpose: the Anca Visuals video frame — thin uppercase title, grey [subtitle], black player in a
 * thin white square border, no gold. Shared by "Video scurt" on /media/:slug and "Vezi-ne la lucru"
 * on /oferta/olx; the page passes the player and anything below it (e.g. the album's download row).
 */
import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export default function FramedVideoSection({ id, title, subtitle, children, footer, className = "" }: Props) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`mx-auto w-full max-w-5xl ${className}`}>
      <header className="mb-5 text-center">
        <h2 id={`${id}-title`} className="text-2xl font-extralight uppercase tracking-[0.18em] text-white sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-neutral-500">[ {subtitle} ]</p>
      </header>
      <div className="border border-white/15 bg-black p-1 sm:p-2">{children}</div>
      {footer}
    </section>
  );
}
