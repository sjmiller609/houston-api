import post from "./post";
import { catchAsyncError } from "errors";
import express from "express";

const router = new express.Router();

// Configure JSON parsing express middleware.
router.use(
  express.json({
    type: ["application/json"]
  }),
  express.urlencoded({ extended: false })
);

// Setup the POST route.
router.post("/", catchAsyncError(post));

export default router;
