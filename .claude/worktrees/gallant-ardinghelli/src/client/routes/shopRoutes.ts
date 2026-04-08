import Mainpage from "../pages/Homepage/Mainpage";

import { publicRoutesType } from "./types";

const shopRoutes: publicRoutesType[] = [
  {
    path: "",
    layout: null,
    component: Mainpage,
  },
];

export default shopRoutes;
