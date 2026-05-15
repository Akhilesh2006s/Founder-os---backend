import { Router } from "express";
import {
  addSubtask,
  addTaskComment,
  createTask,
  deleteSubtask,
  deleteTask,
  getTaskById,
  listTasks,
  updateSubtask,
  updateTask,
  updateTaskStatus
} from "../controllers/task.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const taskRouter = Router();

taskRouter.use(requireAuth);
taskRouter.get("/", listTasks);
taskRouter.post("/", createTask);
taskRouter.get("/:taskId", getTaskById);
taskRouter.patch("/:taskId", updateTask);
taskRouter.patch("/:taskId/status", updateTaskStatus);
taskRouter.post("/:taskId/comments", addTaskComment);
taskRouter.post("/:taskId/subtasks", addSubtask);
taskRouter.patch("/:taskId/subtasks/:subtaskId", updateSubtask);
taskRouter.delete("/:taskId/subtasks/:subtaskId", deleteSubtask);
taskRouter.delete("/:taskId", deleteTask);
