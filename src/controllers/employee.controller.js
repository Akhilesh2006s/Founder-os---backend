import mongoose from "mongoose";
import { z } from "zod";
import { ClientModel } from "../models/Client.js";
import { EmployeeModel } from "../models/Employee.js";
import { TaskModel } from "../models/Task.js";
import { apiSuccess } from "../utils/apiResponse.js";
import { paginateQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/ApiError.js";
import { logActivity } from "../services/activity-log.service.js";

function taskIsActive(status) {
  return status !== "Completed" && status !== "Archived";
}

/** Map employeeId -> Set of task ids from portfolio assign flow across all clients. */
function buildAssignmentTaskIdsByEmployee(clients) {
  const map = new Map();
  for (const client of clients) {
    for (const project of client.projects ?? []) {
      for (const update of project.updates ?? []) {
        for (const a of update.assignments ?? []) {
          const eid = String(a.employeeId);
          if (!map.has(eid)) map.set(eid, new Set());
          if (a.taskId) map.get(eid).add(String(a.taskId));
        }
      }
    }
  }
  return map;
}

/** Map employeeId -> assignment context keyed by taskId (for todo detail). */
function buildAssignmentContextByEmployee(clients) {
  const map = new Map();
  for (const client of clients) {
    const clientId = String(client._id);
    const clientCompany = client.company ?? "";
    for (const project of client.projects ?? []) {
      const projectName = project.name ?? "";
      for (const update of project.updates ?? []) {
        for (const a of update.assignments ?? []) {
          if (!a.taskId) continue;
          const eid = String(a.employeeId);
          if (!map.has(eid)) map.set(eid, new Map());
          map.get(eid).set(String(a.taskId), {
            clientId,
            clientCompany,
            projectName,
            note: update.note ?? "",
            reportDate: update.reportDate,
            assignedAt: a.assignedAt
          });
        }
      }
    }
  }
  return map;
}

const emergencySchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  relation: z.string().min(1)
});

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  department: z.string().min(1),
  role: z.string().min(1),
  joiningDate: z.string(),
  userId: z.string().optional(),
  attendanceRate: z.number().min(0).max(100).optional(),
  leaveBalance: z.number().nonnegative().optional(),
  payrollStatus: z.enum(["Pending", "Processed"]).optional(),
  emergencyContact: emergencySchema
});

const updateSchema = createSchema.partial();

export async function listEmployees(req, res) {
  const filter = {};
  if (req.query.department) filter.department = String(req.query.department);
  if (req.query.payrollStatus) filter.payrollStatus = String(req.query.payrollStatus);
  const result = await paginateQuery(EmployeeModel, req.query, filter, ["name", "email", "department", "role"]);
  return res.json(apiSuccess(result));
}

/** All employees with counts of assigned work (from portfolio assign + task assignees). */
export async function listEmployeesTodoSummary(_req, res) {
  const [employees, clients, tasks] = await Promise.all([
    EmployeeModel.find().sort({ name: 1 }).lean(),
    ClientModel.find().select("company projects").lean(),
    TaskModel.find().select("assignees status").lean()
  ]);

  const assignmentIdsByEmployee = buildAssignmentTaskIdsByEmployee(clients);
  const taskIdsByEmployee = new Map(
    employees.map((e) => [String(e._id), new Set(assignmentIdsByEmployee.get(String(e._id)) ?? [])])
  );

  for (const task of tasks) {
    for (const emp of employees) {
      if (!emp.userId) continue;
      const uid = String(emp.userId);
      if ((task.assignees ?? []).some((a) => String(a) === uid)) {
        taskIdsByEmployee.get(String(emp._id))?.add(String(task._id));
      }
    }
  }

  const allIds = [...new Set([...taskIdsByEmployee.values()].flatMap((s) => [...s]))];
  const statusById = new Map();
  if (allIds.length) {
    const docs = await TaskModel.find({ _id: { $in: allIds } })
      .select("status")
      .lean();
    for (const t of docs) statusById.set(String(t._id), t.status);
  }

  const rows = employees.map((emp) => {
    const ids = taskIdsByEmployee.get(String(emp._id)) ?? new Set();
    let activeCount = 0;
    let totalCount = 0;
    for (const tid of ids) {
      totalCount += 1;
      if (taskIsActive(statusById.get(tid) ?? "Pending")) activeCount += 1;
    }
    return {
      _id: emp._id,
      name: emp.name,
      department: emp.department,
      role: emp.role,
      email: emp.email,
      activeCount,
      totalCount
    };
  });

  return res.json(apiSuccess({ employees: rows }));
}

export async function getEmployeeAssignedWork(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid employee id");

  const employee = await EmployeeModel.findById(req.params.id).lean();
  if (!employee) throw new ApiError(404, "Employee not found");

  const clients = await ClientModel.find().select("company projects").lean();
  const contextByTaskId = buildAssignmentContextByEmployee(clients).get(String(employee._id)) ?? new Map();

  const taskIdSet = new Set(contextByTaskId.keys());
  if (employee.userId) {
    const byAssignee = await TaskModel.find({ assignees: employee.userId }).select("_id").lean();
    for (const t of byAssignee) taskIdSet.add(String(t._id));
  }

  if (!taskIdSet.size) {
    return res.json(apiSuccess({ employee, items: [] }));
  }

  const tasks = await TaskModel.find({ _id: { $in: [...taskIdSet] } })
    .populate("linkedClientId", "company")
    .sort({ updatedAt: -1 })
    .lean();

  const items = tasks.map((task) => {
    const ctx = contextByTaskId.get(String(task._id));
    const linked = task.linkedClientId;
    const clientCompany =
      ctx?.clientCompany ??
      (linked && typeof linked === "object" && "company" in linked ? linked.company : "");
    const clientId =
      ctx?.clientId ??
      (linked && typeof linked === "object" && "_id" in linked ? String(linked._id) : linked ? String(linked) : "");

    return {
      task: {
        _id: task._id,
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        linkedProject: task.linkedProject ?? "",
        dueDate: task.dueDate,
        updatedAt: task.updatedAt
      },
      clientId: clientId || undefined,
      clientCompany: clientCompany || undefined,
      projectName: ctx?.projectName ?? task.linkedProject ?? "",
      note: ctx?.note,
      reportDate: ctx?.reportDate,
      assignedAt: ctx?.assignedAt
    };
  });

  return res.json(apiSuccess({ employee, items }));
}

export async function getEmployee(req, res) {
  const emp = await EmployeeModel.findById(req.params.id);
  if (!emp) throw new ApiError(404, "Employee not found");
  return res.json(apiSuccess(emp));
}

export async function createEmployee(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());

  const existing = await EmployeeModel.findOne({ email: parsed.data.email.toLowerCase() });
  if (existing) throw new ApiError(409, "Email already in use");

  const emp = await EmployeeModel.create({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    department: parsed.data.department,
    role: parsed.data.role,
    joiningDate: new Date(parsed.data.joiningDate),
    attendanceRate: parsed.data.attendanceRate ?? 0,
    leaveBalance: parsed.data.leaveBalance ?? 0,
    payrollStatus: parsed.data.payrollStatus ?? "Pending",
    emergencyContact: parsed.data.emergencyContact,
    userId:
      parsed.data.userId && mongoose.isValidObjectId(parsed.data.userId)
        ? new mongoose.Types.ObjectId(parsed.data.userId)
        : null
  });

  await logActivity({
    actorUserId: req.user.id,
    action: "employee.create",
    entityType: "Employee",
    entityId: emp._id.toString(),
    after: emp.toObject()
  });

  return res.status(201).json(apiSuccess(emp));
}

export async function updateEmployee(req, res) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload", parsed.error.flatten());

  const emp = await EmployeeModel.findById(req.params.id);
  if (!emp) throw new ApiError(404, "Employee not found");
  const before = emp.toObject();

  const d = parsed.data;
  if (d.name !== undefined) emp.name = d.name;
  if (d.email !== undefined) emp.email = d.email.toLowerCase();
  if (d.department !== undefined) emp.department = d.department;
  if (d.role !== undefined) emp.role = d.role;
  if (d.joiningDate !== undefined) emp.joiningDate = new Date(d.joiningDate);
  if (d.attendanceRate !== undefined) emp.attendanceRate = d.attendanceRate;
  if (d.leaveBalance !== undefined) emp.leaveBalance = d.leaveBalance;
  if (d.payrollStatus !== undefined) emp.payrollStatus = d.payrollStatus;
  if (d.emergencyContact !== undefined) emp.emergencyContact = d.emergencyContact;
  if (d.userId !== undefined)
    emp.userId =
      d.userId && mongoose.isValidObjectId(d.userId) ? new mongoose.Types.ObjectId(d.userId) : null;

  await emp.save();

  await logActivity({
    actorUserId: req.user.id,
    action: "employee.update",
    entityType: "Employee",
    entityId: emp._id.toString(),
    before,
    after: emp.toObject()
  });

  return res.json(apiSuccess(emp));
}

export async function deleteEmployee(req, res) {
  const emp = await EmployeeModel.findById(req.params.id);
  if (!emp) throw new ApiError(404, "Employee not found");
  const before = emp.toObject();
  await emp.deleteOne();
  await logActivity({
    actorUserId: req.user.id,
    action: "employee.delete",
    entityType: "Employee",
    entityId: req.params.id,
    before
  });
  return res.json(apiSuccess(null, "Employee deleted"));
}
