import { z } from "zod";

export const composeNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1200),
  type: z.enum(["Task", "Payment", "Meeting", "Approval", "FollowUp", "System"]).optional(),
  payload: z.any().optional()
});
