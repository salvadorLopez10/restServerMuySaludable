import { Router } from "express";
import {
  getCodigos,
  getCodigo,
  createCodigo
} from "../controllers/codigos_descuento";

const router = Router();

router.get("/", getCodigos);
router.get("/:id", getCodigo);
router.post("/", createCodigo);

export default router;
