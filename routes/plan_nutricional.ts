import { Router } from "express";
import { creaPlanNutricional, getPlanNutricionalByIdUsuario, updatePlanNutricional } from "../controllers/plan_nutricional";

const router = Router();

router.get("/:idUser", getPlanNutricionalByIdUsuario);
router.post("/", creaPlanNutricional);
router.put('/:id', updatePlanNutricional );

export default router;