import { Router } from "express";
import {
  getAlimentos,
  getAlimento,
  postAlimento
} from "../controllers/nuevos_alimentos";

const router = Router();

router.get("/", getAlimentos);
router.get("/:id", getAlimento);
router.post("/", postAlimento);
// router.put("/:id", putUsuario);
// router.delete("/:id", deleteUsuario);

export default router;
