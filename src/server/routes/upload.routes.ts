import { Router, type Request, type Response } from "express";
import multer from "multer";
import {
  BUNNY_ACCESS_KEY_HEADER,
  BUNNY_QR_MOMENT_FOLDER,
  MAX_QR_UPLOAD_FILES,
  MAX_QR_UPLOAD_FILE_SIZE_BYTES,
  getBunnyStoragePassword,
  buildBunnyStorageUrl,
} from "../constants/bunny";
import { firestore } from "../firestore";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  // Guardrail for guest uploads so a single request cannot exhaust server memory.
  limits: { fileSize: MAX_QR_UPLOAD_FILE_SIZE_BYTES },
});

router.post("/upload-qr-moment", upload.array("files", MAX_QR_UPLOAD_FILES), async (req: Request, res: Response) => {
  const { eventId, comment } = req.body;
  const files = req.files as Express.Multer.File[];

  if (!eventId || !files?.length) {
    return res.status(400).json({ error: "Lipsește eventId sau fișiere" });
  }

  const accessKey = getBunnyStoragePassword();

  if (!accessKey) {
    console.error("Lipsește BUNNY_STORAGE_PASSWORD în env");
    return res.status(500).json({ error: "Configurare server eronată" });
  }

  try {
    const uploadPromises = files.map(async file => {
      const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      let detectedType: "photo" | "video" | "audio";

      const mime = file.mimetype.toLowerCase();
      const ext = file.originalname.toLowerCase().split(".").pop() || "";

      if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
        detectedType = "photo";
      } else if (mime.startsWith("video/") && ["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) {
        detectedType = "video";
      } else if (mime.startsWith("audio/") && ["mp3", "wav", "m4a", "ogg", "aac", "webm"].includes(ext)) {
        detectedType = "audio";
      } else {
        throw new Error(`Unsupported file type: ${file.mimetype} (${file.originalname})`);
      }

      const uploadUrl = buildBunnyStorageUrl(eventId, BUNNY_QR_MOMENT_FOLDER, detectedType, safeFileName);
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          [BUNNY_ACCESS_KEY_HEADER]: accessKey,
          "Content-Type": "application/octet-stream",
        },
        body: file.buffer,
      });

      if (!response.ok) {
        throw new Error(`Bunny upload failed for ${file.originalname}: ${response.status}`);
      }

      return safeFileName;
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    await firestore()
      .collection("qr-moments")
      .doc(eventId)
      .collection("uploads")
      .add({
        files: uploadedFiles,
        comment: (comment as string | undefined)?.trim() || null,
        uploadedAt: new Date(),
      });

    return res.status(200).json({
      success: true,
      uploadedCount: uploadedFiles.length,
      message: "Fișiere încărcate cu succes pe Bunny!",
    });
  } catch (error) {
    console.error("Bunny upload error:", error);
    return res.status(500).json({ error: "Eroare la upload pe Bunny" });
  }
});

export default router;
