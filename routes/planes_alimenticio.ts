import { Router } from "express";
import {
  getAllPlans,
  getPlanById
} from "../controllers/planes_alimenticios";

const router = Router();

router.get("/", getAllPlans);
router.get("/:id", getPlanById);

export default router;
