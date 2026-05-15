import { Router } from "express";
import {
  createOperation,
  deleteOperation,
  listOperations,
  patchOperation
} from "../controllers/operation.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const operationRouter = Router();
operationRouter.use(requireAuth);

operationRouter.get("/", listOperations);
operationRouter.post("/", createOperation);
operationRouter.patch("/:id", patchOperation);
operationRouter.delete("/:id", deleteOperation);
