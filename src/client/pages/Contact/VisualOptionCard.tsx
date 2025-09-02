// VisualOptionCard.tsx
import { useRef, useState } from 'react';
import type { CustomOption } from './packages';

type Props = {
  opt: CustomOption;
  checked: boolean;
  onChange: () => void;
};

export default function VisualOptionCard({ opt, checked, onChange }: Props) {
  const [hover, setHover] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const onEnter = () => {
    setHover(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };
  const onLeave = () => {
    setHover(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <label
      className={`opt-card ${checked ? 'is-checked' : ''}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onTouchStart={onEnter}
    >
      <div className='opt-header'>
        <input type='checkbox' checked={checked} onChange={onChange} aria-checked={checked} />
        <div className='opt-title'>
          <span className='opt-label'>{opt.label}</span>
          <span className='opt-price'>
            {opt.free ? <span className='badge-free'>GRATUIT</span> : `${opt.price} RON`}
          </span>
        </div>
      </div>

      <div className='opt-previews'>
        {opt.visuals.map((v, idx) =>
          v.type === 'image' ? (
            <img
              key={idx}
              src={v.src}
              alt={v.alt || opt.label}
              loading='lazy'
              className='opt-thumb'
              draggable={false}
            />
          ) : (
            <div className='opt-video-wrap' key={idx}>
              <video
                ref={videoRef}
                className='opt-video'
                muted
                loop
                playsInline
                preload='metadata'
                poster={v.poster}
                // redă DOAR când e hover/touch (evităm CPU mare în listă)
              />
              {/* setăm sursa doar când e hover, ca să nu încarce degeaba */}
              {hover && <source src={v.src} type='video/webm' />}
              {/* dacă vrei mp4 fallback:
                 {hover && <source src="/assets/video/preview.mp4" type="video/mp4" />} */}
            </div>
          )
        )}
      </div>
    </label>
  );
}
