import { Router } from "express";
import { getKeyStripeClient } from "../controllers/config";

const router = Router();

router.get("/stripe_client", getKeyStripeClient);

export default router;
