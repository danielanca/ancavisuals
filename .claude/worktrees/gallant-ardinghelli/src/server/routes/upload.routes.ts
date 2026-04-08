import { Router } from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

const upload = multer({ storage: multer.memoryStorage() }); // salvează în memorie, nu pe disk

router.post('/upload-qr-moment', upload.array('files', 25), async (req, res) => {
  const { eventId, type } = req.body;
  const files = req.files as Express.Multer.File[];

  if (!files?.length || !eventId) {
    return res.status(400).json({ error: 'Lipsește eventId sau fișiere' });
  }

  const bunnyHostname = 'storage.bunnycdn.com'; // din dashboard-ul tău
  const storageZone = 'ancavisuals-rc'; // numele zonei tale
  const accessKey = process.env.BUNNY_STORAGE_PASSWORD; // Password-ul din FTP & API access

  if (!accessKey) throw new Error('Lipsește BUNNY_STORAGE_PASSWORD în .env');

  const uploadPromises = files.map(async (file) => {
    const fileName = `${Date.now()}-${file.originalname}`;
    const bunnyPath = `/${storageZone}/${eventId}/${type}/${fileName}`;

    const response = await fetch(`https://${bunnyHostname}${bunnyPath}`, {
      method: 'PUT',
      headers: {
        'AccessKey': accessKey,
        'Content-Type': 'application/octet-stream',
      },
      body: file.buffer,
    });

    if (!response.ok) {
      throw new Error(`Eroare Bunny: ${response.status} pentru ${fileName}`);
    }

    return fileName;
  });

  try {
    const uploadedFiles = await Promise.all(uploadPromises);
    res.json({
      success: true,
      uploadedCount: uploadedFiles.length,
      message: 'Fișiere încărcate pe Bunny!',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Eroare la upload pe Bunny' });
  }
});

export default router;