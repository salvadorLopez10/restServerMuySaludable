import { Router } from "express";
import {
  getSuscripciones,
  getSuscripcion,
  postSuscripcion
} from "../controllers/suscripcion";

const router = Router();

router.get("/", getSuscripciones);
router.get("/:id", getSuscripcion);
router.post("/", postSuscripcion);

export default router;
