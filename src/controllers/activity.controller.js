import { ActivityLogModel } from "../models/ActivityLog.js";
import { UserModel } from "../models/User.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { paginateQuery } from "../utils/pagination.js";

export async function listActivityLogs(req, res) {
  const filter = {};
  if (req.query.action) filter.action = String(req.query.action);
  if (req.query.entityType) filter.entityType = String(req.query.entityType);

  const result = await paginateQuery(ActivityLogModel, req.query, filter, ["entityId", "action", "entityType"]);

  /** Attach actor names in batch */
  const actorIds = [...new Set(result.items.map((doc) => String(doc.actorUserId)))];
  const actors =
    actorIds.length > 0
      ? await UserModel.find({ _id: { $in: actorIds } }).select("name email")
      : [];
  const actorMap = Object.fromEntries(actors.map((a) => [String(a._id), `${a.name} <${a.email}>`]));

  const items = result.items.map((doc) => ({
    ...doc.toObject(),
    actorLabel: actorMap[String(doc.actorUserId)] ?? String(doc.actorUserId)
  }));

  return res.json(
    apiSuccess({
      ...result,
      items
    })
  );
}
