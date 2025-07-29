import { Router } from "express";
import {
  getRecordsCarousel,
  getActiveRecordsCarousel,
  getRecordsCarouselByType,
  getScheduledRecordsCarousel,
  createCarouselRecord,
  createCarouselRecords,
} from "../controllers/carousel_images";

const router = Router();

router.get("/", getRecordsCarousel);
router.get('/active', getActiveRecordsCarousel); // Para el frontend
router.get("/filter_tipo/:tipo", getRecordsCarouselByType);
router.get('/scheduled', getScheduledRecordsCarousel); // Programados
router.post('/', createCarouselRecord); // Crear nuevo
router.post('/createBulk', createCarouselRecords); // Crear nuevo

export default router;
