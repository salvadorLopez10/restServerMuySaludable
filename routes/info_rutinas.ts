import { Router } from "express";
import {
    getRecordsRutinas,
    getRecordRutinas,
    postRutinas,
    inactiveAndSaveRutinaPerTitle,
} from "../controllers/info_rutinas";

const router = Router();

router.get("/", getRecordsRutinas);
router.get("/:id", getRecordRutinas);
router.post("/", postRutinas);
router.post("/reemplazaActivosPorTitulo", inactiveAndSaveRutinaPerTitle);

export default router;
