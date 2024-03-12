import { Router } from "express";
import { deleteUsuario, emailExists, getUsuario, getUsuarios, postUsuario, putUsuario } from "../controllers/usuarios";


const router  = Router();


router.get('/', getUsuarios );
router.get('/:id', getUsuario );
router.post('/', postUsuario );
router.put('/:id', putUsuario );
router.delete('/:id', deleteUsuario );
router.post('/checkEmail', emailExists );


export default router;