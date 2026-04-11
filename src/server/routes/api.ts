import type { Request, Response } from "express";
import { triggerEvent } from "../controllers/triggerEvent.controller";

export { triggerEvent };

export const getApi = async (req: Request, res: Response) => {
  return res.status(200).json({ message: "Welcome to the API!" });
};
