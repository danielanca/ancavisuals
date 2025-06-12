import loadable from '@loadable/component';

const Mainpage = loadable(() => import('../pages/Homepage/Mainpage'), { ssr: true });
const Aboutme = loadable(() => import('../pages/About/Aboutme'), { ssr: true });

import { publicRoutesType } from './types';

const publicRoutes: publicRoutesType[] = [
  {
    path: '',
    layout: null,
    component: Mainpage,
  },
  {
    path: '/about',
    layout: null,
    component: Aboutme,
  },
];

export default publicRoutes;
