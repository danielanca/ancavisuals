import loadable from '@loadable/component';

const MostWanted = loadable(() => import('../pages/Mainpage'), { ssr: true });
const VideoPlayer = loadable(() => import('../components/VideoPlayer/VideoPlayer'), { ssr: true });
const ChatPage = loadable(() => import('../components/ChatArea/ChatPage'), {
  ssr: true,
});
const AudioPlayer = loadable( ()=> import('../components/AudioPlayer/AudioPlayer'));

import { publicRoutesType } from './types';

const gameRoutes: publicRoutesType[] = [
  {
    path: 'game/most-wanted',
    layout: null,
    component: MostWanted,
  },
  {
    path: 'game/video', //game/video will work only on MOBILE VERSION (for a while)
    layout: null,
    component: VideoPlayer,
  },
  {
    path: 'game/chat',
    layout: null,
    component: ChatPage,
  },
];

    path: 'game/audio', //game/video will work only on MOBILE VERSION (for a while)
    layout: null,
    component: AudioPlayer,
  },

];

export default gameRoutes;
