import { Router } from "express";
import {
  deleteDocument,
  getR2Health,
  listDocuments,
  presignUpload,
  registerDocument,
  uploadDocument
} from "../controllers/document.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { documentUpload } from "../middleware/document-upload.middleware.js";

export const documentRouter = Router();

documentRouter.use(requireAuth);
documentRouter.get("/r2-health", getR2Health);
documentRouter.post("/presign-upload", presignUpload);
documentRouter.get("/", listDocuments);
documentRouter.post("/upload", documentUpload.single("file"), uploadDocument);
documentRouter.post("/register", registerDocument);
documentRouter.delete("/:id", deleteDocument);
