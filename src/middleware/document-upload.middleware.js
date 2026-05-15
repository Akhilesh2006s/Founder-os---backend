import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "documents");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 64) || "";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  }
});

export const documentUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

export { UPLOAD_DIR };
