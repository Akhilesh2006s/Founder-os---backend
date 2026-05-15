import { TaskModel } from "../models/Task.js";
import { MeetingModel } from "../models/Meeting.js";
import { InvoiceModel } from "../models/Invoice.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";

export async function getCalendarFeed(req, res) {
  const fromRaw = req.query.from;
  const toRaw = req.query.to;

  const now = new Date();
  const from = fromRaw ? new Date(String(fromRaw)) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toRaw ? new Date(String(toRaw)) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ApiError(400, "Invalid from/to dates");
  }

  const [tasks, meetings, invoices] = await Promise.all([
    TaskModel.find({
      dueDate: { $gte: from, $lte: to }
    })
      .select("title dueDate status priority type createdBy linkedProject")
      .lean(),
    MeetingModel.find({
      scheduledAt: { $gte: from, $lte: to }
    })
      .select("title scheduledAt durationMinutes notes")
      .lean(),
    InvoiceModel.find({
      dueDate: { $gte: from, $lte: to },
      status: { $in: ["Pending", "Unpaid", "Partially Paid", "Overdue"] }
    })
      .select("invoiceNumber dueDate total paidAmount status clientId")
      .populate("clientId", "company")
      .lean()
  ]);

  const events = [
    ...tasks
      .filter((t) => t.dueDate)
      .map((t) => ({
        kind: "task",
        id: t._id,
        startsAt: t.dueDate,
        title: t.title,
        extra: {
          status: t.status,
          priority: t.priority,
          type: t.type
        }
      })),
    ...meetings.map((m) => ({
      kind: "meeting",
      id: m._id,
      startsAt: m.scheduledAt,
      title: m.title,
      extra: { durationMinutes: m.durationMinutes, notes: m.notes }
    })),
    ...invoices.map((inv) => ({
      kind: "invoiceDue",
      id: inv._id,
      startsAt: inv.dueDate,
      title: `Invoice due: ${inv.invoiceNumber}`,
      extra: {
        status: inv.status,
        outstanding: Math.max((inv.total ?? 0) - (inv.paidAmount ?? 0), 0),
        client: inv.clientId?.company ?? ""
      }
    }))
  ].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return res.json(apiSuccess({ from, to, events }));
}
