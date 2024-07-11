import { Router } from "express";
import { creaPlanNutricional, getPlanNutricionalByIdUsuario } from "../controllers/plan_nutricional";

const router = Router();

router.get("/:idUser", getPlanNutricionalByIdUsuario);
router.post("/", creaPlanNutricional);

export default router;