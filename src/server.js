import { connectDb } from "./config/db.js";
import { clientOriginSuffixes, clientOrigins, env } from "./config/env.js";
import { app } from "./app.js";

async function bootstrap() {
  await connectDb();
  if (env.NODE_ENV === "production" && !clientOriginSuffixes.length) {
    console.warn(
      "[cors] CLIENT_ORIGIN_SUFFIXES is empty — add your Vercel team suffix (e.g. team-name.vercel.app) or list every preview URL in CLIENT_ORIGIN."
    );
  }
  app.listen(env.PORT, () => {
    console.log(`FounderOS API (Node.js) listening on port ${env.PORT} — CORS origins: ${clientOrigins.length}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start API", err);
  process.exit(1);
});
