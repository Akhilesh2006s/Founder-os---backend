import "express-async-errors";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { isOriginAllowed } from "./config/env.js";
import { UPLOAD_DIR } from "./middleware/document-upload.middleware.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

/** Respect X-Forwarded-* from Railway reverse proxy */
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ success: true, message: "API running", runtime: "node" });
});

app.use("/uploads/documents", express.static(UPLOAD_DIR));

app.use("/api/v1", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
