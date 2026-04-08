import loadable from "@loadable/component";

const PhoneComponent = loadable(() => import("../components/PhoneComponent/PhoneComponent"), { ssr: true });

import { publicRoutesType } from "./types";

const phoneRoutes: publicRoutesType[] = [
  {
    path: "phone/",
    layout: null,
    component: PhoneComponent,
  },
];

export default phoneRoutes;
