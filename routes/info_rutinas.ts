import { Router } from "express";
import {
    getRecordsRutinas,
    getRecordRutinas,
    postRutinas,
} from "../controllers/info_rutinas";

const router = Router();

router.get("/", getRecordsRutinas);
router.get("/:id", getRecordRutinas);
router.post("/", postRutinas);

export default router;
