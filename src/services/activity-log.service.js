import { ActivityLogModel } from "../models/ActivityLog.js";

export async function logActivity(input) {
  await ActivityLogModel.create({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? {}
  });
}
