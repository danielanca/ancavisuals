import loadable from '@loadable/component';

const Mainpage = loadable(() => import('../pages/Mainpage'), { ssr: true });

import { publicRoutesType } from './types';

const publicRoutes: publicRoutesType[] = [
  {
    path: '',
    layout: null,
    component: Mainpage,
  },
];

export default publicRoutes;
