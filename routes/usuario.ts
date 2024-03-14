import { Router } from "express";
import { deleteUsuario, emailExists, getUsuario, getUsuarios, postUsuario, putUsuario, login } from "../controllers/usuarios";


const router  = Router();


router.get('/', getUsuarios );
router.get('/:id', getUsuario );
router.post('/', postUsuario );
router.post('/login', login );
router.put('/:id', putUsuario );
router.delete('/:id', deleteUsuario );
router.post('/checkEmail', emailExists );


export default router;