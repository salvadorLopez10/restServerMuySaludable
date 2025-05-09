import { Router } from "express";
import {
  getRecordsCarousel,
  getRecordCarousel,
  getRecordsCarouselByType,
  postCarousel,
} from "../controllers/carousel_images";

const router = Router();

router.get("/", getRecordsCarousel);
router.get("/:id", getRecordCarousel);
router.get("/filter_tipo/:tipo", getRecordsCarouselByType);
router.post("/", postCarousel);

export default router;
