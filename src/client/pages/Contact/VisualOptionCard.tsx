import type { PackageOption } from './packages'; // <— exista deja in repo, CUSTOM_OPTIONS: PackageOption[]

// descriere minimală pt elementele vizuale (imagini / gif / video)
type Visual = {
  kind: 'img' | 'gif' | 'video';
  src: string;
  alt?: string;
  poster?: string; // pt video
};

type Props = {
  opt: PackageOption & { visuals?: Visual[] };
  checked: boolean;
  onToggle: () => void;
};

export default function VisualOptionCard({ opt, checked, onToggle }: Props) {
  return (
    <label className='visual-option' style={{ display: 'block', cursor: 'pointer' }}>
      <input type='checkbox' checked={checked} onChange={onToggle} style={{ marginRight: 8 }} />
      <div className='content'>
        <div className='header' style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span className='title' style={{ fontWeight: 600 }}>
            {opt.label}
          </span>
          <span className='price' style={{ opacity: 0.8 }}>
            {opt.price} RON
          </span>
        </div>

        {opt.visuals && opt.visuals.length > 0 && (
          <div
            className='gallery'
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 8,
              marginTop: 8,
            }}
          >
            {opt.visuals.map((v: Visual, idx: number) => {
              if (v.kind === 'img' || v.kind === 'gif') {
                return (
                  <img
                    key={idx}
                    src={v.src}
                    alt={v.alt ?? opt.label}
                    loading='lazy'
                    style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }}
                  />
                );
              }
              // video preview / loop
              return (
                <video
                  key={idx}
                  src={v.src}
                  poster={v.poster}
                  autoPlay
                  muted
                  playsInline
                  loop
                  preload='metadata'
                  style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }}
                />
              );
            })}
          </div>
        )}

        {opt.description && (
          <p className='desc' style={{ marginTop: 8, opacity: 0.8 }}>
            {opt.description}
          </p>
        )}
      </div>
    </label>
  );
}
