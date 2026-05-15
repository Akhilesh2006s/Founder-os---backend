import mongoose from "mongoose";
import { z } from "zod";
import { VisitorModel } from "../models/Visitor.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { paginateQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/ApiError.js";
import { logActivity } from "../services/activity-log.service.js";

const createSchema = z.object({
  name: z.string().min(2),
  purpose: z.string().min(1),
  contact: z.string().optional(),
  meetingWithEmployeeId: z.string().length(24).optional(),
  meetingRoom: z.string().optional(),
  securityNotes: z.string().optional()
});

const patchSchema = z.object({
  name: z.string().optional(),
  purpose: z.string().optional(),
  contact: z.string().optional(),
  meetingWithEmployeeId: z.union([z.string().length(24), z.literal(null)]).optional(),
  meetingRoom: z.string().optional(),
  approvalStatus: z.enum(["Pending", "Approved", "Rejected"]).optional(),
  checkInAt: z.union([z.string(), z.literal(null)]).optional(),
  checkOutAt: z.union([z.string(), z.literal(null)]).optional(),
  securityNotes: z.string().optional()
});

export async function listVisitors(req, res) {
  const filter = {};
  if (req.query.approvalStatus) filter.approvalStatus = String(req.query.approvalStatus);
  const result = await paginateQuery(VisitorModel, req.query, filter, ["name", "purpose", "contact", "meetingRoom"]);
  return res.json(apiSuccess(result));
}

export async function createVisitor(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());

  const visitor = await VisitorModel.create({
    name: parsed.data.name,
    purpose: parsed.data.purpose,
    contact: parsed.data.contact ?? "",
    meetingWithEmployeeId:
      parsed.data.meetingWithEmployeeId && mongoose.isValidObjectId(parsed.data.meetingWithEmployeeId)
        ? new mongoose.Types.ObjectId(parsed.data.meetingWithEmployeeId)
        : null,
    meetingRoom: parsed.data.meetingRoom ?? "",
    securityNotes: parsed.data.securityNotes ?? ""
  });

  await logActivity({
    actorUserId: req.user.id,
    action: "visitor.create",
    entityType: "Visitor",
    entityId: visitor._id.toString(),
    after: visitor.toObject()
  });

  return res.status(201).json(apiSuccess(visitor));
}

export async function patchVisitor(req, res) {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());

  const v = await VisitorModel.findById(req.params.id);
  if (!v) throw new ApiError(404, "Visitor not found");

  const before = v.toObject();
  const d = parsed.data;
  if (d.name !== undefined) v.name = d.name;
  if (d.purpose !== undefined) v.purpose = d.purpose;
  if (d.contact !== undefined) v.contact = d.contact;
  if (d.meetingRoom !== undefined) v.meetingRoom = d.meetingRoom;
  if (d.securityNotes !== undefined) v.securityNotes = d.securityNotes;
  if (d.approvalStatus !== undefined) v.approvalStatus = d.approvalStatus;

  if (d.meetingWithEmployeeId !== undefined) {
    v.meetingWithEmployeeId =
      d.meetingWithEmployeeId && mongoose.isValidObjectId(d.meetingWithEmployeeId)
        ? new mongoose.Types.ObjectId(d.meetingWithEmployeeId)
        : null;
  }

  if (d.checkInAt !== undefined)
    v.checkInAt = d.checkInAt === null ? null : new Date(d.checkInAt);
  if (d.checkOutAt !== undefined)
    v.checkOutAt = d.checkOutAt === null ? null : new Date(d.checkOutAt);

  await v.save();

  await logActivity({
    actorUserId: req.user.id,
    action: "visitor.update",
    entityType: "Visitor",
    entityId: v._id.toString(),
    before,
    after: v.toObject()
  });

  return res.json(apiSuccess(v));
}

export async function deleteVisitor(req, res) {
  const v = await VisitorModel.findById(req.params.id);
  if (!v) throw new ApiError(404, "Visitor not found");
  const before = v.toObject();
  await v.deleteOne();
  await logActivity({
    actorUserId: req.user.id,
    action: "visitor.delete",
    entityType: "Visitor",
    entityId: req.params.id,
    before
  });
  return res.json(apiSuccess(null, "Visitor removed"));
}
