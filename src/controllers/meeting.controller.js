import mongoose from "mongoose";
import { z } from "zod";
import { MeetingModel } from "../models/Meeting.js";
import { TaskModel } from "../models/Task.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { paginateQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/ApiError.js";
import { logActivity } from "../services/activity-log.service.js";
import { notifyUsers } from "../services/notification.service.js";

const createSchema = z.object({
  title: z.string().min(2),
  scheduledAt: z.string(),
  durationMinutes: z.number().positive().optional().default(30),
  attendees: z.array(z.string().length(24)).optional(),
  notes: z.string().optional(),
  decisions: z.array(z.string()).optional()
});

const updateSchema = createSchema.partial();

function mapAttendeeIds(ids) {
  return (ids ?? []).filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
}

export async function listMeetings(req, res) {
  const filter = {};
  if (req.query.from && req.query.to) {
    filter.scheduledAt = {
      $gte: new Date(String(req.query.from)),
      $lte: new Date(String(req.query.to))
    };
  }
  const result = await paginateQuery(MeetingModel, req.query, filter, ["title", "notes"]);

  /** Explicit timing fields — virtuals serialize in toObject; ISO strings aid clients & caching layers */
  result.items = result.items.map((m) => {
    const base = typeof m.toObject === "function" ? m.toObject({ virtuals: true }) : { ...m };
    const durRaw = typeof m.durationMinutes === "number" ? m.durationMinutes : null;
    const dur = durRaw !== null && durRaw > 0 ? durRaw : 30;

    let startMs = NaN;
    if (m.scheduledAt instanceof Date) startMs = m.scheduledAt.getTime();
    else if (m.scheduledAt) startMs = new Date(String(m.scheduledAt)).getTime();

    if (!Number.isFinite(startMs)) {
      return {
        ...base,
        durationMinutes: dur,
        computedDurationMinutes: dur,
        startTime: base.startTime ?? null,
        endTime: base.endTime ?? null
      };
    }

    const start = new Date(startMs);
    const endMs = startMs + dur * 60 * 1000;
    const endTime = new Date(endMs);

    return {
      ...base,
      startTime: start.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes: dur,
      computedDurationMinutes: dur
    };
  });

  return res.json(apiSuccess(result));
}

export async function getMeeting(req, res) {
  const m = await MeetingModel.findById(req.params.id).populate("attendees createdBy", "name email role");
  if (!m) throw new ApiError(404, "Meeting not found");
  return res.json(apiSuccess(m));
}

export async function createMeeting(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());

  const meeting = await MeetingModel.create({
    title: parsed.data.title,
    scheduledAt: new Date(parsed.data.scheduledAt),
    durationMinutes: parsed.data.durationMinutes,
    attendees: mapAttendeeIds(parsed.data.attendees),
    notes: parsed.data.notes ?? "",
    decisions: parsed.data.decisions ?? [],
    createdBy: req.user.id
  });

  await logActivity({
    actorUserId: req.user.id,
    action: "meeting.create",
    entityType: "Meeting",
    entityId: meeting._id.toString(),
    after: meeting.toObject()
  });

  const attendeeIds = mapAttendeeIds(parsed.data.attendees).map((oid) => String(oid));
  const organizer = String(req.user.id);
  const recipients = attendeeIds.filter((id) => id !== organizer);
  if (recipients.length) {
    const when = new Date(parsed.data.scheduledAt).toLocaleString();
    await notifyUsers(recipients, {
      type: "Meeting",
      title: `You're invited: ${parsed.data.title}`,
      message: when,
      payload: { meetingId: meeting._id.toString() }
    }).catch(() => {});
  }

  return res.status(201).json(apiSuccess(meeting));
}

export async function updateMeeting(req, res) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());

  const m = await MeetingModel.findById(req.params.id);
  if (!m) throw new ApiError(404, "Meeting not found");
  if (String(m.createdBy) !== req.user.id) {
    const elevated = ["Founder", "CEO", "Operations"].includes(req.user.role);
    if (!elevated) throw new ApiError(403, "Only owner or admins can edit");
  }

  const before = m.toObject();
  const d = parsed.data;
  if (d.title !== undefined) m.title = d.title;
  if (d.scheduledAt !== undefined) m.scheduledAt = new Date(d.scheduledAt);
  if (d.durationMinutes !== undefined) m.durationMinutes = d.durationMinutes;
  if (d.attendees !== undefined) m.attendees = mapAttendeeIds(d.attendees);
  if (d.notes !== undefined) m.notes = d.notes ?? "";
  if (d.decisions !== undefined) m.decisions = d.decisions ?? [];
  await m.save();

  await logActivity({
    actorUserId: req.user.id,
    action: "meeting.update",
    entityType: "Meeting",
    entityId: m._id.toString(),
    before,
    after: m.toObject()
  });

  return res.json(apiSuccess(m));
}

export async function deleteMeeting(req, res) {
  const m = await MeetingModel.findById(req.params.id);
  if (!m) throw new ApiError(404, "Meeting not found");
  const before = m.toObject();
  await m.deleteOne();
  await logActivity({
    actorUserId: req.user.id,
    action: "meeting.delete",
    entityType: "Meeting",
    entityId: req.params.id,
    before
  });
  return res.json(apiSuccess(null, "Meeting deleted"));
}

const taskFromMeetingSchema = z.object({
  title: z.string().min(2),
  assigneeUserIds: z.array(z.string().length(24)).optional()
});

export async function spawnTasksFromMeeting(req, res) {
  const parsed = taskFromMeetingSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());

  const meeting = await MeetingModel.findById(req.params.id);
  if (!meeting) throw new ApiError(404, "Meeting not found");

  const task = await TaskModel.create({
    title: `[Meeting] ${parsed.data.title}`,
    description: `From meeting "${meeting.title}" at ${meeting.scheduledAt.toISOString()}\n\n${meeting.notes}`,
    priority: "High",
    type: "One-time",
    dueDate: meeting.scheduledAt,
    assignees: mapAttendeeIds(parsed.data.assigneeUserIds ?? []),
    createdBy: req.user.id,
    linkedProject: `meeting:${meeting._id.toString()}`
  });

  await logActivity({
    actorUserId: req.user.id,
    action: "meeting.spawnTask",
    entityType: "Meeting",
    entityId: meeting._id.toString(),
    metadata: { taskId: task._id.toString() }
  });

  return res.status(201).json(apiSuccess({ task }));
}
