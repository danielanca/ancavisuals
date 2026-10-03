import { heavyPhotoNote } from "../../../shared/media/photoWeight";

/**
 * Admin-only mark over a photo that visitors don't get because it is too heavy
 * (server lists them in `heavy` for the admin). The parent must be position: relative.
 */
export default function HeavyPhotoFlag({ bytes }: { bytes?: number }) {
  if (!bytes) return null;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] ring-[3px] ring-inset ring-red-600">
      <span className="absolute left-2 right-2 top-2 rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold leading-snug text-white shadow-lg">
        {heavyPhotoNote(bytes)}
      </span>
    </span>
  );
}
