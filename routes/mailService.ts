import { Router } from "express";
import { sendEmail, sendEmailRenew, sendEmailTest, sendWelcomeEmailOnlyUser } from "../controllers/mailService";

const router = Router();

router.post('/', sendEmail );
router.post('/testing', sendEmailTest );
router.post('/sendWelcomeEmailOnlyUser', sendWelcomeEmailOnlyUser );
router.post('/sendEmailRenew', sendEmailRenew );

export default router;