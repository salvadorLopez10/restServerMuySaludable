import { Router } from "express";
import { creaPlanNutricional, getAllPlansActiveByIdUsuario, getPlanNutricionalByIdUsuario, updatePlanNutricional } from "../controllers/plan_nutricional";

const router = Router();

router.get("/:idUser", getPlanNutricionalByIdUsuario);
router.get("/planesActivos/:idUser", getAllPlansActiveByIdUsuario);
router.post("/", creaPlanNutricional);
router.put('/:id', updatePlanNutricional );

export default router;