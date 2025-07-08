import { Router } from "express";
import {
    getRecomendaciones,
    getRecomendacion,
    postRecomendacion,
    postRecomendaciones,
} from "../controllers/recomendaciones_planes";

const router = Router();

router.get("/", getRecomendaciones);
router.get("/:id", getRecomendacion);
router.post("/", postRecomendacion);
router.post("/bulk", postRecomendaciones);

export default router;
