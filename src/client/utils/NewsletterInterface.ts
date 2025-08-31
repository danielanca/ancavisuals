export interface NewsProps {
  fullName: string;
  email: string;
}
export interface responseProps {
  subscribeToNewsletter: "SUBSCRIBED" | "INITSTATE" | "ERROR";
}

export interface EventInsert {
  [key: string]: string;
}
