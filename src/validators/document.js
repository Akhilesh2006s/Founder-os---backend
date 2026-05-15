import { z } from "zod";

const docTypeEnum = z.enum(["Invoice", "Agreement", "Employee", "SOP", "Legal", "Meeting", "Bill", "Other"]);

export const registerDocumentSchema = z.object({
  name: z.string().min(2),
  type: docTypeEnum.optional().default("Other"),
  storageKey: z.string().min(1),
  url: z.string().url(),
  mimeType: z.string().optional()
});
