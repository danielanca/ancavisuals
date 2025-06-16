import loadable from '@loadable/component';

const Mainpage = loadable(() => import('../pages/Homepage/Mainpage'), { ssr: true });
const Aboutme = loadable(() => import('../pages/About/Aboutme'), { ssr: true });
const Portfolio = loadable(() => import('../pages/Portfolio/Portfolio'), { ssr: true });
const Contact = loadable(() => import('../pages/Contact/Contacts'), { ssr: true });

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
   {
    path: '/portfolio',
    layout: null,
    component: Portfolio,
  },
   {
    path: '/contact',
    layout: null,
    component: Contact,
  },
];

export default publicRoutes;
