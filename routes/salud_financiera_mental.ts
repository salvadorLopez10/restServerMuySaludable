import { Router } from "express";
import { getSaludFinanciera,getSaludMental } from "../controllers/salud_financiera_mental";

const router = Router();

router.get("/salud_financiera", getSaludFinanciera);
router.get("/salud_mental", getSaludMental);

export default router;
