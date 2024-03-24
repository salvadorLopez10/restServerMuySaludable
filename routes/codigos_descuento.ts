import { Router } from "express";
import {
  getCodigos,
  getCodigoById,
  createCodigo,
  getCodigoByName,
} from "../controllers/codigos_descuento";

const router = Router();

router.get("/", getCodigos);
router.get("/:id", getCodigoById);
router.get("/getCodigoName/:nombre", getCodigoByName);
router.post("/", createCodigo);

export default router;
