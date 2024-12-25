import loadable from '@loadable/component';

const MostWanted = loadable(() => import('../components/MostWanted/MostWanted'), { ssr: true });
const SingleUser = loadable(() => import('../components/MostWanted/SingleUser'),{ssr:true});
const VideoPlayer = loadable(() => import('../components/VideoPlayer/VideoPlayer'), { ssr: true });
const ChatPage = loadable(() => import('../components/ChatArea/ChatPage'), {
  ssr: true,
});
const AudioPlayer = loadable(() => import('../components/AudioPlayer/AudioPlayer'));

const Interceptor = loadable(() => import('../pages/Sniffer/Interceptor/Interceptor'));
const Messages = loadable(() => import('../pages/Sniffer/Interceptor/Messages'));
const Conversations = loadable(() => import('../pages/Sniffer/Interceptor/Conversations'));
const ConversationsInfo = loadable(() => import('../pages/Sniffer/Interceptor/ConversationInfo'));
const Prompt = loadable(() => import('../pages/Prompt/Prompt'));
import { publicRoutesType } from './types';


const gameRoutes: publicRoutesType[] = [
  {
    path: 'game/prompt',
    layout: null,
    component: Prompt,
  },
  {
    path: 'game/most-wanted',
    layout: null,
    component: MostWanted,
  },
  {
    path: 'game/most-wanted/:userID',
    layout: null,
    component: SingleUser,
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
  {
    path: 'game/audio',
    layout: null,
    component: AudioPlayer,
  },
  {
    path: 'game/interceptor',
    layout: null,
    component: Interceptor,
  },
  {
    path: 'game/interceptor/messages',
    layout: null,
    component: Messages,
  },
  {
    path: 'game/interceptor/number/:scanNR',
    layout: null,
    component: Conversations,
  },
  {
    path: 'game/interceptor/conversationsInfo/:scanNR/:otherNumber',
    layout: null,
    component: ConversationsInfo,
  },
];

export default gameRoutes;
