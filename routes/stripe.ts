import { Router } from "express";
import {
  createPayment
} from "../controllers/stripe";

const router = Router();

router.post("/", createPayment);

export default router;
