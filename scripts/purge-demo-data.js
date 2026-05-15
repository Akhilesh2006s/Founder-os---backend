/**
 * Removes demo rows only (same rules as the old seed script).
 * Matches: "[Demo]" prefix on title/company/name · invoices "DEMO-*" · payments notes "DEMO_PAY*"
 *
 * Usage: npm run purge:demo
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ClientModel } from "../src/models/Client.js";
import { LeadModel } from "../src/models/Lead.js";
import { TaskModel } from "../src/models/Task.js";
import { ExpenseModel } from "../src/models/Expense.js";
import { EmployeeModel } from "../src/models/Employee.js";
import { MeetingModel } from "../src/models/Meeting.js";
import { VisitorModel } from "../src/models/Visitor.js";
import { NotificationModel } from "../src/models/Notification.js";
import { OperationItemModel } from "../src/models/OperationItem.js";
import { DocumentModel } from "../src/models/Document.js";
import { InvoiceModel } from "../src/models/Invoice.js";
import { PaymentModel } from "../src/models/Payment.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const P = "[Demo]";

function regexpEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function wipeDemoCollections() {
  const demoClients = await ClientModel.find({
    company: new RegExp(`^${regexpEscape(P)}`)
  }).select("_id");
  const demoClientIds = demoClients.map((c) => c._id);

  const demoInvoices = await InvoiceModel.find({
    $or: [{ invoiceNumber: /^DEMO-/ }, { clientId: { $in: demoClientIds } }]
  }).select("_id");
  const demoInvoiceIds = demoInvoices.map((i) => i._id);

  await PaymentModel.deleteMany({
    $or: [{ notes: /^DEMO_PAY/ }, { invoiceId: { $in: demoInvoiceIds } }]
  });
  await InvoiceModel.deleteMany({
    $or: [{ invoiceNumber: /^DEMO-/ }, { clientId: { $in: demoClientIds } }]
  });
  await TaskModel.deleteMany({ title: new RegExp(`^${regexpEscape(P)}`) });
  await TaskModel.deleteMany({ linkedClientId: { $in: demoClientIds } });
  await LeadModel.deleteMany({ company: new RegExp(`^${regexpEscape(P)}`) });
  await ClientModel.deleteMany({ company: new RegExp(`^${regexpEscape(P)}`) });
  await ExpenseModel.deleteMany({ title: new RegExp(`^${regexpEscape(P)}`) });
  await EmployeeModel.deleteMany({ name: new RegExp(`^${regexpEscape(P)}`) });
  await MeetingModel.deleteMany({ title: new RegExp(`^${regexpEscape(P)}`) });
  await VisitorModel.deleteMany({ name: new RegExp(`^${regexpEscape(P)}`) });
  await NotificationModel.deleteMany({ title: new RegExp(`^${regexpEscape(P)}`) });
  await OperationItemModel.deleteMany({ title: new RegExp(`^${regexpEscape(P)}`) });
  await DocumentModel.deleteMany({ name: new RegExp(`^${regexpEscape(P)}`) });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGO_URI");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Purging demo data ([Demo] / DEMO-* / DEMO_PAY*)…");
  await wipeDemoCollections();
  console.log("Done.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
