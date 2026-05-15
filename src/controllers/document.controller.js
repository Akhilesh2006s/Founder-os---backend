import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { env } from "../config/env.js";
import { DocumentModel } from "../models/Document.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { paginateQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/ApiError.js";
import { logActivity } from "../services/activity-log.service.js";
import { registerDocumentSchema } from "../validators/document.js";
import { UPLOAD_DIR } from "../middleware/document-upload.middleware.js";

const presignSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional()
});

const docTypeEnumUpload = z.enum([
  "Invoice",
  "Agreement",
  "Employee",
  "SOP",
  "Legal",
  "Meeting",
  "Bill",
  "Other"
]);

async function deleteStoredBlob(doc) {
  const storageKey = typeof doc.storageKey === "string" ? doc.storageKey : "";
  if (!storageKey) return;

  const isLocal =
    doc.storageProvider === "Local" || storageKey.startsWith("local/");

  if (isLocal) {
    const fileName = path.basename(storageKey.replace(/^local\//, ""));
    if (!fileName || fileName.includes("..")) return;
    const abs = path.join(UPLOAD_DIR, fileName);
    try {
      await fs.unlink(abs);
    } catch (e) {
      if (e?.code !== "ENOENT") {
        console.warn("Local document unlink failed:", e?.message ?? e);
      }
    }
    return;
  }

  if (
    doc.storageProvider === "R2" &&
    env.R2_BUCKET_NAME &&
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY
  ) {
    try {
      const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: "auto",
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY
        }
      });
      await client.send(
        new DeleteObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: storageKey
        })
      );
    } catch (e) {
      console.warn(
        "R2 delete skipped or failed (install @aws-sdk/client-s3 and check credentials):",
        e?.message ?? e
      );
    }
  }
}

export async function deleteDocument(req, res) {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Document not found");

  const uid = req.user?.id;
  if (!uid) throw new ApiError(401, "Authentication required");

  const before = doc.toObject();
  await deleteStoredBlob(doc);
  await doc.deleteOne();

  await logActivity({
    actorUserId: uid,
    action: "document.delete",
    entityType: "Document",
    entityId: req.params.id,
    before
  });

  return res.json(apiSuccess(null, "Document deleted successfully"));
}

function displayNameFromFile(file, bodyName) {
  if (typeof bodyName === "string") {
    const t = bodyName.trim();
    if (t.length >= 2) return t.slice(0, 240);
  }
  const base = path.basename(file?.originalname || "document").trim() || "document";
  return base.slice(0, 240);
}

export async function listDocuments(req, res) {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  const result = await paginateQuery(DocumentModel, req.query, filter, ["name", "storageKey"]);
  return res.json(apiSuccess(result));
}

/** Store file on API disk (development / simple hosting) */
export async function uploadDocument(req, res) {
  if (!req.file) throw new ApiError(400, "Choose a file to upload");

  const uid = req.user?.id;
  if (!uid) throw new ApiError(401, "Authentication required");

  let docType = "Other";
  if (typeof req.body?.type === "string") {
    const p = docTypeEnumUpload.safeParse(req.body.type);
    if (p.success) docType = p.data;
  }

  const name = displayNameFromFile(req.file, req.body?.name);
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/documents/${req.file.filename}`;
  const storageKey = `local/${req.file.filename}`;

  const doc = await DocumentModel.create({
    name,
    type: docType,
    storageProvider: "Local",
    storageKey,
    url: fileUrl,
    mimeType: req.file.mimetype || "application/octet-stream",
    uploadedBy: uid
  });

  await logActivity({
    actorUserId: uid,
    action: "document.upload",
    entityType: "Document",
    entityId: doc._id.toString(),
    after: doc.toObject()
  });

  return res.status(201).json(apiSuccess(doc, "File uploaded"));
}

/** Register metadata after client uploads binary to R2 (or completes presigned PUT) */
export async function registerDocument(req, res) {
  const parsed = registerDocumentSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid document payload", parsed.error.flatten());

  if (!env.R2_BUCKET_NAME) {
    console.warn("R2_BUCKET_NAME missing — storing document metadata anyway (configure R2 for production).");
  }

  const doc = await DocumentModel.create({
    name: parsed.data.name,
    type: parsed.data.type,
    storageProvider: "R2",
    storageKey: parsed.data.storageKey,
    url: parsed.data.url,
    mimeType: parsed.data.mimeType ?? "application/octet-stream",
    uploadedBy: req.user.id
  });

  await logActivity({
    actorUserId: req.user.id,
    action: "document.register",
    entityType: "Document",
    entityId: doc._id.toString(),
    after: doc.toObject()
  });

  return res.status(201).json(apiSuccess(doc, "Document registered"));
}

export async function getR2Health(_req, res) {
  const configured = Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME
  );
  return res.json(
    apiSuccess({
      r2Configured: configured,
      publicBaseUrl: env.R2_PUBLIC_BASE_URL ?? ""
    })
  );
}

/** Placeholder for S3-compatible presigned PUT; returns key + readiness when R2 env is set */
export async function presignUpload(req, res) {
  const parsed = presignSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());

  const safeName = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `uploads/${Date.now()}-${safeName}`;
  const r2Configured = Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME
  );

  if (!r2Configured) {
    return res.json(
      apiSuccess({
        mode: "disabled",
        message: "Set R2_* env vars and implement getSignedUrl(PutObjectCommand) in document.controller.presignUpload.",
        suggestedKey: key,
        mimeType: parsed.data.mimeType ?? "application/octet-stream"
      })
    );
  }

  return res.json(
    apiSuccess({
      mode: "stub",
      message: "R2 credentials present; wire @aws-sdk/s3-request-presigner + PutObjectCommand to return uploadUrl.",
      bucket: env.R2_BUCKET_NAME,
      key,
      mimeType: parsed.data.mimeType ?? "application/octet-stream"
    })
  );
}
