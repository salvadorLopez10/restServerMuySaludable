import { Router } from "express";
import { createSaludRecord, getSaludFinanciera,getSaludMental } from "../controllers/salud_financiera_mental";

const router = Router();

router.get("/salud_financiera", getSaludFinanciera);
router.get("/salud_mental", getSaludMental);
router.post("/", createSaludRecord);

export default router;
