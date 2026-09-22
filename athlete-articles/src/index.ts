import type { Env } from "./lib/env";
import { Router, type RequestContext } from "./router";
import { handlePreflight, withCors } from "./middleware/cors";
import { authenticate } from "./middleware/auth";
import { checkRateLimit, RateLimitRules } from "./middleware/rateLimit";
import { Errors } from "./lib/response";
import { runDailyPipeline } from "./pipeline/run";

import {
  approveSourceRecordHandler,
  createSourceRecordHandler,
  deprecateSourceRecordHandler,
  generateSourceRecordHandler,
  getSourceRecordDetailHandler,
  listSourceRecordsHandler,
  patchSourceRecordHandler,
  rejectSourceRecordHandler,
  reviewQueueHandler,
  stuckSourceRecordsHandler,
} from "./routes/admin/sourceRecords";
import { listPipelineRunsHandler } from "./routes/admin/pipelineRuns";
import { statsHandler } from "./routes/admin/stats";
import { getModelEvalHandler, getModelsHandler, modelEvalHandler, updateModelsHandler } from "./routes/admin/models";
import { validateModelsHandler } from "./routes/admin/modelValidation";
import { appendModelTestNoteHandler, listModelTestNotesHandler } from "./routes/admin/modelTestNotes";
import { getUserDetailHandler, listUsersHandler, patchUserHandler, setBillingStatusHandler, setSuperuserHandler } from "./routes/admin/users";
import { listAuditLogHandler } from "./routes/admin/auditLog";

import { getOwnProfileHandler, patchOwnProfileHandler } from "./routes/me/profile";
import { catalogHandler } from "./routes/me/catalog";
import { listSelectionsHandler, setSelectionHandler } from "./routes/me/selections";
import { getThunkHandler } from "./routes/me/thunk";

import { readThunkHandler } from "./routes/public/read";

const ADMIN_ROUTE_PREFIX = "/admin";
const ME_ROUTE_PREFIX = "/me";

const router = new Router();

// --- Admin routes (Firebase Admin-project token required) ---
router.post("/admin/source-records", createSourceRecordHandler);
router.get("/admin/source-records", listSourceRecordsHandler);
router.get("/admin/source-records/stuck", stuckSourceRecordsHandler); // must be registered before the :id route below
router.get("/admin/source-records/:id", getSourceRecordDetailHandler);
router.patch("/admin/source-records/:id", patchSourceRecordHandler);
router.get("/admin/review-queue", reviewQueueHandler);
router.post("/admin/source-records/:id/approve", approveSourceRecordHandler);
router.post("/admin/source-records/:id/reject", rejectSourceRecordHandler);
router.post("/admin/source-records/:id/deprecate", deprecateSourceRecordHandler);
router.post("/admin/source-records/:id/generate", generateSourceRecordHandler);
router.get("/admin/pipeline-runs", listPipelineRunsHandler);
router.get("/admin/stats", statsHandler);
router.get("/admin/models", getModelsHandler);
router.put("/admin/models", updateModelsHandler);
router.post("/admin/models/eval", modelEvalHandler);
router.get("/admin/models/eval/:id", getModelEvalHandler);
router.post("/admin/models/validate", validateModelsHandler);
router.get("/admin/model-test-notes", listModelTestNotesHandler);
router.post("/admin/model-test-notes", appendModelTestNoteHandler);
router.get("/admin/users", listUsersHandler);
router.get("/admin/users/:id", getUserDetailHandler);
router.patch("/admin/users/:id", patchUserHandler);
router.post("/admin/users/:id/billing-status", setBillingStatusHandler);
router.post("/admin/users/:id/superuser", setSuperuserHandler);
router.get("/admin/audit-log", listAuditLogHandler);

// --- Coach/Parent routes (Firebase Coach/Parent-project token required, always self-scoped) ---
router.get("/me", getOwnProfileHandler);
router.patch("/me", patchOwnProfileHandler);
router.get("/me/catalog", catalogHandler);
router.get("/me/selections", listSelectionsHandler);
router.put("/me/selections/:year/:week", setSelectionHandler);
router.get("/me/thunk", getThunkHandler);

// --- Public (no auth) ---
router.get("/read/:thunk", readThunkHandler);

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const preflight = handlePreflight(request, env);
  if (preflight) return preflight;

  const url = new URL(request.url);
  const match = router.match(request.method, url.pathname);
  if (!match) {
    return Errors.notFound("No matching route.");
  }

  const isPublicRoute = !url.pathname.startsWith(ADMIN_ROUTE_PREFIX) && !url.pathname.startsWith(ME_ROUTE_PREFIX);

  // CORS applies to every response — the public thunk read is called from
  // the Coach/Parent Application's own origin too (an athlete's browser
  // opens the app's `/#/:thunk` page, which then fetches this endpoint).
  let user = null;
  if (!isPublicRoute) {
    const project = url.pathname.startsWith(ADMIN_ROUTE_PREFIX) ? "admin" : "coach";
    user = await authenticate(request, env, project);
    if (!user) {
      return withCors(Errors.unauthorized(), request, env);
    }

    const limit = await checkRateLimit(env, RateLimitRules.authenticatedUser(user.uid));
    if (!limit.allowed) {
      return withCors(Errors.rateLimited(), request, env);
    }
  }

  const context: RequestContext = { request, env, ctx, url, params: match.params, user };

  try {
    const response = await match.handler(context);
    return withCors(response, request, env);
  } catch (error) {
    console.error("Unhandled route error:", error);
    return withCors(Errors.internal(), request, env);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runDailyPipeline(env).catch((error) => {
        console.error("Daily pipeline run failed unexpectedly:", error);
      }),
    );
  },
};
