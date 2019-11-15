import alerts from "./alerts";
import authorization from "./authorization";
import elasticsearch from "./elasticsearch";
import healthz from "./healthz";
import oauth from "./oauth";
import registry from "./registry";
import express from "express";
import promBundle from "express-prom-bundle";

// Create top level router for v1.
const router = new express.Router();

// Attach routes.
router.use("/alerts", alerts);
router.use("/authorization", authorization);
router.use("/elasticsearch", elasticsearch);
router.use("/healthz", healthz);
router.use("/oauth", oauth);
router.use("/registry", registry);

// Attach prometheus route.
router.use(
  promBundle({
    includeMethod: true,
    metricsPath: "/v1/metrics"
  })
);

// Export the v1 router.
export default router;
