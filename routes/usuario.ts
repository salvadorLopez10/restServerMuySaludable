import { Router } from "express";
import { deleteUsuario, emailExists, getUsuario, getUsuarios, postUsuario, putUsuario, login, calculateTMB, generateMealPlan } from "../controllers/usuarios";


const router  = Router();


router.get('/', getUsuarios );
router.get('/:id', getUsuario );
router.get('/calculateTMB/:id', calculateTMB );
router.post('/', postUsuario );
router.post('/login', login );
router.put('/:id', putUsuario );
router.delete('/:id', deleteUsuario );
router.post('/checkEmail', emailExists );
router.post('/generatePlan', generateMealPlan );


export default router;