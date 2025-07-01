import { Router } from "express";
import { UploadFile } from "../controllers/upload_file_service";

const router = Router();

router.post('/', UploadFile );

export default router;