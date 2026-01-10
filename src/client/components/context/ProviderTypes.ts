export interface Provi {
  email: string;
  password: string;
  accessToken: string;
  authorise: boolean | null;
}
export interface ProviInter {
  auth: Provi;
  setAuth?: React.Dispatch<React.SetStateAction<Provi>>;
}
