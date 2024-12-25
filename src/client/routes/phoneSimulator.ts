import { publicRoutesType } from './types';
import LockScreen from '../components/PhoneSimulator/LockScreen';
import MobilePasscode from '../components/PhoneSimulator/MobilePasscode';
import MobileHome from '../components/PhoneSimulator/MobileHome';

const PhoneSimulator: publicRoutesType[] = [
  {
    path: 'phone/lock-screen',
    layout: null,
    component: LockScreen,
  },
  {
    path: 'phone/passcode',
    layout: null,
    component: MobilePasscode,
  },
  {
    path: 'phone/home',
    layout: null,
    component: MobileHome,
  },
];

export default PhoneSimulator;
