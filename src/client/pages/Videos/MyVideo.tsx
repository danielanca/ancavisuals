import React, { useEffect, useRef } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import './video.css';

interface MyVideoProps {
  src: string;
  poster?: string;
}

const MyVideo: React.FC<MyVideoProps> = ({ src, poster }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const player = new Plyr(containerRef.current.querySelector('video')!, {
      controls: [
        'play',
        'progress',
        'current-time',
        'mute',
        'volume',
        'settings',
        'fullscreen',
      ],
      settings: ['quality', 'speed'],
    });

    return () => {
      player.destroy();
    };
  }, [src]);

  return (
    <div className="video-wrapper">
      <div ref={containerRef}>
        <video
          className="plyr-react plyr"
          playsInline
          poster={poster}
          preload="metadata"
        >
          <source src={src} type="video/mp4" />
        </video>
      </div>
    </div>
  );
};

export default MyVideo;
