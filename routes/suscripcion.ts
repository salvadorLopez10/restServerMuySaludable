import { Router } from "express";
import {
  getSuscripciones,
  getSuscripcion,
  postSuscripcion,
  updateSuscripcion
} from "../controllers/suscripcion";

const router = Router();

router.get("/", getSuscripciones);
router.get("/:id", getSuscripcion);
router.post("/", postSuscripcion);
router.put('/:id', updateSuscripcion );

export default router;
