import type { ServiceType } from "./locationData";

// Only these services have a public overview page; local pages support more services.
// Its own small module: the routes need it, without pulling in all the city content.
export const SERVICE_HUB_SLUGS: ServiceType[] = ["nunta", "botez", "majorat", "evenimente"];
