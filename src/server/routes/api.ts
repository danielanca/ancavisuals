import { Request, Response } from "express";
import { triggerEvent } from "../functions/eventFuncs";

export { triggerEvent };

export const getApi = async (req: Request, res: Response) => {
  return res.status(200).json({ message: "Welcome to the API!" });
};
