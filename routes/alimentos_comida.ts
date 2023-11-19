import { Router } from "express";
import {
  getAlimentosComidas,
  getAlimentoComidas,
  postRelacionAlimentosComidas,
  crearComidaConAlimentos
} from "../controllers/alimentos_comidas";

const router = Router();

router.get("/", getAlimentosComidas);
router.get("/:id", getAlimentoComidas);
router.post("/", postRelacionAlimentosComidas);
router.post("/crearComida", crearComidaConAlimentos);
// router.put("/:id", putUsuario);
// router.delete("/:id", deleteUsuario);

export default router;
