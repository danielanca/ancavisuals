import Mainpage from "../pages/Homepage/Mainpage";

import { publicRoutesType } from "./types";

const adminRoutes: publicRoutesType[] = [
  {
    path: "",
    layout: null,
    component: Mainpage,
  },
];

export default adminRoutes;
