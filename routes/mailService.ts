import { Router } from "express";
import { sendEmail } from "../controllers/mailService";

const router = Router();

router.post('/', sendEmail );

export default router;