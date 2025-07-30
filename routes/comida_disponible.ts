import { Router } from "express";
import { 
    getComidasDisponibles, 
    getComidaDisponible, 
    postComidaDisponible, 
    putComidaDisponible, 
    deleteComidaDisponible,
    getComidasByDietAndObjective 
} from "../controllers/comida_disponible";

const router = Router();

router.get('/', getComidasDisponibles);
router.get('/:id', getComidaDisponible);
router.get('/filter/:tipo_dieta/:objetivo', getComidasByDietAndObjective);
router.post('/', postComidaDisponible);
router.put('/:id', putComidaDisponible);
router.delete('/:id', deleteComidaDisponible);

export default router;