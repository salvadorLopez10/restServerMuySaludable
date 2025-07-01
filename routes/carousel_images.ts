import { Router } from "express";
import {
  getRecordsCarousel,
  getActiveRecordsCarousel,
  getRecordsCarouselByType,
  getScheduledRecordsCarousel,
  createCarouselRecord,
} from "../controllers/carousel_images";

const router = Router();

router.get("/", getRecordsCarousel);
router.get('/active', getActiveRecordsCarousel); // Para el frontend
router.get("/filter_tipo/:tipo", getRecordsCarouselByType);
router.get('/scheduled', getScheduledRecordsCarousel); // Programados
router.post('/', createCarouselRecord); // Crear nuevo

export default router;
