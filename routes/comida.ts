import { Router } from "express";
import {
  getComidas,
  getComida,
  postComida,
} from "../controllers/comidas";

const router = Router();

router.get("/", getComidas);
router.get("/:id", getComida);
router.post("/", postComida);
// router.put("/:id", putUsuario);
// router.delete("/:id", deleteUsuario);

export default router;
