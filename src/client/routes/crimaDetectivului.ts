
import { publicRoutesType } from './types';
import CrimaDetectivului from '../components/CrimaDetectivului/CrimaDetectivului';

const chatRoutes: publicRoutesType[] = [
  {
    path: '/crima-detectivului',
    layout: null,
    component: CrimaDetectivului,
  },
];

export default chatRoutes;
