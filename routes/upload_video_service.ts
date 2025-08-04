import { Router } from "express";
import { UploadVideo, getUploadedVideos, deleteVideo } from "../controllers/upload_video_service";

const router = Router();

router.post('/upload-video', UploadVideo);
router.get('/videos', getUploadedVideos);
router.delete('/videos/:filename', deleteVideo);

export default router;