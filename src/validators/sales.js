import { z } from "zod";

export const PIPELINE_STAGES = [
  "New Lead",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost"
];

const pipelineStageEnum = z.enum([
  "New Lead",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost"
]);

export const createLeadSchema = z.object({
  company: z.string().min(2),
  contactPerson: z.string().min(2),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  industry: z.string().optional(),
  estimatedDealValue: z.number().nonnegative().optional(),
  followUpDate: z.string().optional(),
  notes: z.string().optional(),
  assignedSalesRepId: z.string().optional()
});

export const updateLeadSchema = createLeadSchema.partial();

export const updateLeadStageSchema = z
  .object({
    stage: pipelineStageEnum,
    lostReason: z.string().optional()
  })
  .superRefine((data, ctx) => {
    if (data.stage === "Lost") {
      if (!data.lostReason || data.lostReason.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "lostReason required (min 2 chars) when stage is Lost"
        });
      }
    }
  });

export const updateClientSchema = z.object({
  company: z.string().min(2).optional(),
  contactPerson: z.string().min(2).optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().optional(),
  dealValue: z.number().nonnegative().optional(),
  paymentStatus: z.enum(["Paid", "Pending"]).optional(),
  projectSummary: z.string().optional(),
  supportStatus: z.enum(["Healthy", "At Risk"]).optional()
});

export const addClientProjectSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["Planning", "Active", "On Hold", "Completed"]).optional(),
  description: z.string().optional()
});

export const convertLeadBodySchema = z.object({
  force: z.boolean().optional()
});

export const updateClientProjectSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["Planning", "Active", "On Hold", "Completed"]).optional(),
  description: z.string().optional()
});

export const addProjectUpdateSchema = z.object({
  note: z.string().min(1),
  reportDate: z.string().optional()
});

export const updateProjectUpdateSchema = z.object({
  note: z.string().min(1).optional(),
  reportDate: z.string().optional()
});

export const assignProjectUpdateSchema = z.object({
  employeeId: z.string().min(1),
  reassign: z.boolean().optional()
});
