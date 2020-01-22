import handler from "./handler";
import { catchAsyncError } from "errors";
import express from "express";

const router = new express.Router();

// Configure JSON parsing express middleware.
router.use(
  express.json({
    type: ["application/json"]
  })
);

// Houston 1 currently defines both methods.
router.post("/", catchAsyncError(handler));
router.get("/", catchAsyncError(handler));

export default router;
