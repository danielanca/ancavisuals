import publicRoutes from "./publicRoutes";
// import shopRoutes from './shopRoutes';
import gameRoutes from "./gameRoutes";
import chatRoutes from "./chatRoutes";
import phoneSimulator from "./phoneSimulator";
import crimaDetectivului from "./crimaDetectivului";

const routes = [
  ...publicRoutes,
  // ...adminRoutes,
  // ...shopRoutes,
  ...gameRoutes,
  ...chatRoutes,
  ...phoneSimulator,
  ...crimaDetectivului,
];

export default routes;
