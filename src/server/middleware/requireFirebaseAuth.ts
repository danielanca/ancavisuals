import type { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";
import { firestore } from "../firestore";

const SUPREME_ADMIN_EMAIL = "ancadaniel1994@gmail.com";

export interface AuthenticatedRequest extends Request {
  firebaseUid: string;
  firebaseEmail: string;
  isSupremeAdmin: boolean;
}

export async function requireFirebaseAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token lipsă" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    firestore(); // ensure Firebase Admin is initialized
    const decoded = await getAuth().verifyIdToken(token);
    const authReq = req as AuthenticatedRequest;
    authReq.firebaseUid = decoded.uid;
    authReq.firebaseEmail = decoded.email ?? "";
    authReq.isSupremeAdmin = decoded.email === SUPREME_ADMIN_EMAIL;
    next();
  } catch {
    res.status(401).json({ error: "Token invalid" });
  }
}

export function requireSupremeAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.isSupremeAdmin) {
    res.status(403).json({ error: "Acces interzis" });
    return;
  }
  next();
}
