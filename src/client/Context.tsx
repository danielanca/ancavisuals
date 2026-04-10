import React, { useContext, useState } from "react";
import type { ReactNode } from "react";

export interface Context {
  name: string;
  setName: (val: string) => void;
}
const defaultVal = {
  name: "",
  setName: () => {},
} as Context;

const context = React.createContext(defaultVal);

const { Provider } = context;

type ContextWrapperProps = {
  children: ReactNode;
};

export const ContextWrapper = ({ children }: ContextWrapperProps) => {
  const [name, setName] = useState<string>(defaultVal.name);
  return <Provider value={{ name, setName }}>{children}</Provider>;
};

export const useAppContext = () => useContext(context);
