import { Router } from "express";
import { sendEmail, sendEmailRenew, sendWelcomeEmailOnlyUser } from "../controllers/mailService";

const router = Router();

router.post('/', sendEmail );
router.post('/sendWelcomeEmailOnlyUser', sendWelcomeEmailOnlyUser );
router.post('/sendEmailRenew', sendEmailRenew );

export default router;