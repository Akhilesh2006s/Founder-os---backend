import mongoose from "mongoose";
import { z } from "zod";
import { TaskModel } from "../models/Task.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { paginateQuery } from "../utils/pagination.js";
import { logActivity } from "../services/activity-log.service.js";
import { notifyUsers, stakeholderIds } from "../services/notification.service.js";
import { ApiError } from "../utils/ApiError.js";

const createTaskSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  status: z.enum(["Pending", "In Progress", "Blocked", "Completed", "Overdue", "Archived"]).optional(),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  type: z.enum(["One-time", "Daily", "Weekly", "Monthly", "Recurring"]).optional(),
  dueDate: z.string().optional(),
  linkedProject: z.string().optional(),
  linkedClientId: z.string().optional()
});

const updateTaskSchema = createTaskSchema.partial();

const updateStatusSchema = z.object({
  status: z.enum(["Pending", "In Progress", "Blocked", "Completed", "Overdue", "Archived"])
});

const createCommentSchema = z.object({
  message: z.string().min(1)
});

const createSubtaskSchema = z.object({
  title: z.string().min(1)
});

const toggleSubtaskSchema = z.object({
  done: z.boolean()
});

export async function listTasks(req, res) {
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status);
  if (req.query.priority) filter.priority = String(req.query.priority);
  if (req.query.type) filter.type = String(req.query.type);
  if (req.query.linkedClientId && mongoose.isValidObjectId(String(req.query.linkedClientId))) {
    filter.linkedClientId = new mongoose.Types.ObjectId(String(req.query.linkedClientId));
  }

  const result = await paginateQuery(TaskModel, req.query, filter, ["title", "description", "linkedProject"]);
  return res.json(apiSuccess(result));
}

export async function createTask(req, res) {
  const uid = req.user?.id;
  if (!uid) throw new ApiError(401, "Authentication required");

  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid task payload", parsed.error.flatten());

  const { linkedClientId: lc, ...rest } = parsed.data;
  const task = await TaskModel.create({
    ...rest,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    linkedClientId:
      lc && mongoose.isValidObjectId(lc) ? new mongoose.Types.ObjectId(lc) : undefined,
    createdBy: uid
  });

  await logActivity({
    actorUserId: uid,
    action: "task.create",
    entityType: "Task",
    entityId: task._id.toString(),
    after: task.toObject()
  });

  return res.status(201).json(apiSuccess(task, "Task created"));
}

export async function getTaskById(req, res) {
  const task = await TaskModel.findById(req.params.taskId)
    .populate("assignees", "name email")
    .populate("createdBy", "name email")
    .populate("linkedClientId", "company contactPerson")
    .populate("comments.userId", "name email");

  if (!task) throw new ApiError(404, "Task not found");
  return res.json(apiSuccess(task));
}

export async function updateTask(req, res) {
  const uid = req.user?.id;
  if (!uid) throw new ApiError(401, "Authentication required");

  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid task payload", parsed.error.flatten());

  const task = await TaskModel.findById(req.params.taskId);
  if (!task) throw new ApiError(404, "Task not found");

  const before = task.toObject();
  const next = { ...parsed.data };
  if (next.linkedClientId !== undefined) {
    next.linkedClientId =
      next.linkedClientId && mongoose.isValidObjectId(next.linkedClientId)
        ? new mongoose.Types.ObjectId(next.linkedClientId)
        : null;
  }
  Object.assign(task, {
    ...next,
    dueDate:
      parsed.data.dueDate !== undefined
        ? parsed.data.dueDate
          ? new Date(parsed.data.dueDate)
          : null
        : task.dueDate
  });
  await task.save();

  await logActivity({
    actorUserId: uid,
    action: "task.update",
    entityType: "Task",
    entityId: task._id.toString(),
    before,
    after: task.toObject()
  });

  return res.json(apiSuccess(task, "Task updated"));
}

export async function updateTaskStatus(req, res) {
  const uid = req.user?.id;
  if (!uid) throw new ApiError(401, "Authentication required");

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid status payload", parsed.error.flatten());

  const task = await TaskModel.findById(req.params.taskId);
  if (!task) throw new ApiError(404, "Task not found");

  const before = task.toObject();
  task.status = parsed.data.status;
  await task.save();

  await logActivity({
    actorUserId: uid,
    action: "task.status.update",
    entityType: "Task",
    entityId: task._id.toString(),
    before,
    after: task.toObject()
  });

  const watchers = stakeholderIds(task, uid);
  if (watchers.length && parsed.data.status === "Completed") {
    await notifyUsers(watchers, {
      type: "Task",
      title: `Completed: ${task.title}`,
      message: `${before.status ?? "Prior"} → ${parsed.data.status}`,
      payload: { taskId: task._id.toString(), status: parsed.data.status }
    }).catch(() => {});
  }

  return res.json(apiSuccess(task, "Task status updated"));
}

export async function addTaskComment(req, res) {
  const uid = req.user?.id;
  if (!uid) throw new ApiError(401, "Authentication required");

  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid comment payload", parsed.error.flatten());

  const task = await TaskModel.findById(req.params.taskId);
  if (!task) throw new ApiError(404, "Task not found");

  task.comments.push({
    userId: uid,
    message: parsed.data.message,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  await task.save();

  await logActivity({
    actorUserId: uid,
    action: "task.comment.add",
    entityType: "Task",
    entityId: task._id.toString(),
    metadata: { message: parsed.data.message }
  });

  const commentTargets = stakeholderIds(task, uid);
  const preview = parsed.data.message.length > 200 ? `${parsed.data.message.slice(0, 200)}…` : parsed.data.message;
  if (commentTargets.length) {
    await notifyUsers(commentTargets, {
      type: "Task",
      title: `Comment on "${task.title}"`,
      message: preview,
      payload: { taskId: task._id.toString() }
    }).catch(() => {});
  }

  return res.status(201).json(apiSuccess(task, "Comment added"));
}

export async function addSubtask(req, res) {
  const parsed = createSubtaskSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid subtask payload", parsed.error.flatten());

  const task = await TaskModel.findById(req.params.taskId);
  if (!task) throw new ApiError(404, "Task not found");

  task.subtasks.push({ title: parsed.data.title, done: false });
  await task.save();

  return res.status(201).json(apiSuccess(task, "Subtask added"));
}

export async function updateSubtask(req, res) {
  const parsed = toggleSubtaskSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid subtask payload", parsed.error.flatten());

  const task = await TaskModel.findById(req.params.taskId);
  if (!task) throw new ApiError(404, "Task not found");

  const subtask = task.subtasks.id(req.params.subtaskId);
  if (!subtask) throw new ApiError(404, "Subtask not found");

  subtask.done = parsed.data.done;
  await task.save();

  return res.json(apiSuccess(task, "Subtask updated"));
}

export async function deleteSubtask(req, res) {
  const uid = req.user?.id;
  if (!uid) throw new ApiError(401, "Authentication required");

  const task = await TaskModel.findById(req.params.taskId);
  if (!task) throw new ApiError(404, "Task not found");

  const subtask = task.subtasks.id(req.params.subtaskId);
  if (!subtask) throw new ApiError(404, "Subtask not found");

  const before = task.toObject();
  task.subtasks.pull(subtask._id);
  await task.save();

  await logActivity({
    actorUserId: uid,
    action: "task.subtask.delete",
    entityType: "Task",
    entityId: task._id.toString(),
    before,
    after: task.toObject(),
    metadata: { subtaskId: String(req.params.subtaskId) }
  });

  return res.json(apiSuccess(task, "Subtask deleted successfully"));
}

export async function deleteTask(req, res) {
  const uid = req.user?.id;
  if (!uid) throw new ApiError(401, "Authentication required");

  const task = await TaskModel.findById(req.params.taskId);
  if (!task) throw new ApiError(404, "Task not found");

  const before = task.toObject();
  await task.deleteOne();

  await logActivity({
    actorUserId: uid,
    action: "task.delete",
    entityType: "Task",
    entityId: req.params.taskId,
    before
  });

  return res.json(apiSuccess(null, "Task deleted"));
}
