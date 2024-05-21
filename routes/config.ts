import { Router } from "express";
import { getConfigValue, getKeyStripeClient } from "../controllers/config";

const router = Router();

router.get("/stripe_client", getKeyStripeClient);
router.get('/:value', getConfigValue );

export default router;
