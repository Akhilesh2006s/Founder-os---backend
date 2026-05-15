import { Router } from "express";
import {
  createMeeting,
  deleteMeeting,
  getMeeting,
  listMeetings,
  spawnTasksFromMeeting,
  updateMeeting
} from "../controllers/meeting.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const meetingRouter = Router();
meetingRouter.use(requireAuth);

meetingRouter.get("/", listMeetings);
meetingRouter.post("/", createMeeting);
meetingRouter.get("/:id", getMeeting);
meetingRouter.patch("/:id", updateMeeting);
meetingRouter.delete("/:id", deleteMeeting);
meetingRouter.post("/:id/tasks", spawnTasksFromMeeting);
