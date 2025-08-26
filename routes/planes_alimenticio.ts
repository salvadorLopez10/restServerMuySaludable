import { Router } from "express";
import {
  getAllPlans,
  getPlanById,
  updatePlanAlimenticio
} from "../controllers/planes_alimenticios";

const router = Router();

router.get("/", getAllPlans);
router.get("/:id", getPlanById);
router.put('/:id', updatePlanAlimenticio);

export default router;
