import { Router } from "express";
import {
  getElementosCatalogo,
  getElementoCatalogo
} from "../controllers/catalogo_porcion_tipos";

const router = Router();

router.get("/", getElementosCatalogo);
router.get("/:id", getElementoCatalogo);
//router.post("/", postAlimento);
// router.put("/:id", putUsuario);
// router.delete("/:id", deleteUsuario);

export default router;
