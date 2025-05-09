import { Router } from "express";
import {
    getRecomendaciones,
    getRecomendacion,
    postRecomendacion,
} from "../controllers/recomendaciones_planes";

const router = Router();

router.get("/", getRecomendaciones);
router.get("/:id", getRecomendacion);
router.post("/", postRecomendacion);

export default router;
