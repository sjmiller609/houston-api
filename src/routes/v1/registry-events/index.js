import post from "./post";
import express from "express";
import { DOCKER_REGISTRY_CONTENT_TYPE } from "constants";

const router = new express.Router();

// Configure JSON parsing express middleware.
router.use(express.json({ type: [DOCKER_REGISTRY_CONTENT_TYPE] }));
router.post("/", post);

export default router;
