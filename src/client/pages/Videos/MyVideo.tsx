import React, { useEffect, useRef } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import './video.css'; 

interface MyVideoProps {
  src: string;
  poster?: string;
}

const MyVideo: React.FC<MyVideoProps> = ({ src, poster }) => {
  const playerRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (playerRef.current) {
      const player = new Plyr(playerRef.current, {
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
    }
  }, []);

  return (
    <div className="video-wrapper">
      <video
        ref={playerRef}
        className="plyr-react plyr"
        playsInline
        controls
        poster={poster}
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
};

export default MyVideo;
