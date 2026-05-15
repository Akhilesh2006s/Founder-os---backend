import { z } from "zod";
import mongoose from "mongoose";
import { OperationItemModel } from "../models/OperationItem.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { paginateQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/ApiError.js";
import { logActivity } from "../services/activity-log.service.js";

const createSchema = z.object({
  title: z.string().min(2),
  type: z.enum(["SOP", "Checklist", "Vendor", "Procurement", "Issue"]),
  status: z.enum(["Pending", "In Progress", "Completed", "Blocked"]).optional(),
  ownerId: z.string().length(24).optional(),
  dueDate: z.string().optional(),
  details: z.string().optional()
});

const updateSchema = createSchema.partial();

export async function listOperations(req, res) {
  const filter = {};
  if (req.query.type) filter.type = String(req.query.type);
  if (req.query.status) filter.status = String(req.query.status);
  const result = await paginateQuery(OperationItemModel, req.query, filter, ["title", "details"]);
  return res.json(apiSuccess(result));
}

export async function createOperation(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());

  const item = await OperationItemModel.create({
    title: parsed.data.title,
    type: parsed.data.type,
    status: parsed.data.status ?? "Pending",
    ownerId:
      parsed.data.ownerId && mongoose.isValidObjectId(parsed.data.ownerId)
        ? new mongoose.Types.ObjectId(parsed.data.ownerId)
        : null,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    details: parsed.data.details ?? ""
  });

  await logActivity({
    actorUserId: req.user.id,
    action: "operations.create",
    entityType: "OperationItem",
    entityId: item._id.toString(),
    after: item.toObject()
  });

  return res.status(201).json(apiSuccess(item));
}

export async function patchOperation(req, res) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());

  const item = await OperationItemModel.findById(req.params.id);
  if (!item) throw new ApiError(404, "Item not found");
  const before = item.toObject();
  const d = parsed.data;
  if (d.title !== undefined) item.title = d.title;
  if (d.type !== undefined) item.type = d.type;
  if (d.status !== undefined) item.status = d.status;
  if (d.details !== undefined) item.details = d.details;
  if (d.dueDate !== undefined) item.dueDate = d.dueDate ? new Date(d.dueDate) : null;
  if (d.ownerId !== undefined)
    item.ownerId =
      d.ownerId && mongoose.isValidObjectId(d.ownerId) ? new mongoose.Types.ObjectId(d.ownerId) : null;

  await item.save();
  await logActivity({
    actorUserId: req.user.id,
    action: "operations.update",
    entityType: "OperationItem",
    entityId: item._id.toString(),
    before,
    after: item.toObject()
  });
  return res.json(apiSuccess(item));
}

export async function deleteOperation(req, res) {
  const item = await OperationItemModel.findById(req.params.id);
  if (!item) throw new ApiError(404, "Item not found");
  const before = item.toObject();
  await item.deleteOne();
  await logActivity({
    actorUserId: req.user.id,
    action: "operations.delete",
    entityType: "OperationItem",
    entityId: req.params.id,
    before
  });
  return res.json(apiSuccess(null, "Removed"));
}
