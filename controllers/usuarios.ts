import { Request, Response } from "express";
import Usuario from '../models/usuario';
import { QueryTypes, Sequelize } from "sequelize";
import db from "../db/connection";


export const getUsuarios = async ( req: Request, res: Response ) => {

    const usuarios = await Usuario.findAll();

    res.json({usuarios});

}

export const getUsuario = async (req: Request, res: Response) => {

    const { id } = req.params;

    const usuario = await Usuario.findByPk(id);

    if( usuario ){
        res.json({ usuario });
    }else{
        res.status(404).json({
            msg: `No exite un usuario con el id ${id}`
        });
    }
};

export const postUsuario = async (req: Request, res: Response) => {
  
    const { body } = req;

    try {

        const existeEmail = await Usuario.findOne({
            where: {
                email: body.email
            }
        }); 

        if ( existeEmail ){
            return res.status(200).json({
                status:"Duplicate",
                msg: "Ya existe un usuario con el email "+ body.email,
                data: "",
            });
        }

        const usuario = await Usuario.create({
            email: body.email,
            //password: body.password
        });

        res.status(200).json({
            status: `Ok`,
            msg: "El usuario se ha creado correctamente",
            data: usuario
        });
        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: `Error`,
            msg: "Error: Contacte al administrador"
        });
        
    }

    
};

export const putUsuario = async (req: Request, res: Response) => {
  
    const { id } = req.params;
    const { body } = req;

    try {

       const usuario = await Usuario.findByPk( id );
       if( !usuario ){
        return res.status(404).json({
            msg: 'No existe un usuario con el id ' + id 
        });
       }


       await usuario.update( {
        nombre: body.nombre,
        email: body.email,
        password: body.password,
        edad: body.edad,
        altura: body.altura,
        peso: body.peso,
        sexo: body.sexo,
        actividad_fisica: body.actividad_fisica,
        tipo_dieta: body.tipo_dieta,
        alimentos_evitar: body.alimentos_evitar,
        objetivo: body.objetivo,
        estado_mexico: body.estado_mexico,
       } );

       res.status(200).json({
            status: `Ok`,
            msg: "El usuario se ha actualizado correctamente",
            data: usuario
        });
       
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "Error: Contacte al administrador"
        });
        
    }
};

export const deleteUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;

    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
        return res.status(404).json({
        msg: "No existe un usuario con el id " + id,
        });
    }

    //Eliminación fisica
    //await usuario.destroy();
    await usuario.update({estado: false});


    res.json(usuario);

    // res.json({
    //     msg: "deleteUsuario",
    //     id
    // });
};

export const emailExists = async (req: Request, res: Response) => {
  const { body } = req;

    try {

        const existeEmail = await Usuario.findOne({
            where: {
                email: body.email
            }
        }); 

        if ( existeEmail ){
            
            return res.status(200).json({
                status:"Duplicate",
                msg: "Ya existe un usuario con el email "+ body.email,
                data: existeEmail,
            });

        }else{

            return res.status(200).json({
                status:"Ok",
                msg: "Email no existente",
                data: "",
            });
        }

        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: `Error`,
            msg: "Error: Contacte al administrador"
        });

    }
};

export const login = async (req: Request, res: Response) => {
  const { body } = req;

    try {

        const existeUsuario = await Usuario.findOne({
            where: {
                email: body.email,
                password: body.password
            }
        }); 

        if ( existeUsuario ){
            
            const infoComplete = await getInfoUserWithPlan(existeUsuario.get('id'))

            return res.status(200).json({
                status:"Ok",
                msg: "Login correcto",
                data: infoComplete,
            });

        }else{

            return res.status(200).json({
                status:"Error",
                msg: "Correo y/o contraseña incorrecto(s)",
                data: "",
            });
        }

        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: `Error`,
            msg: "Error: Contacte al administrador"
        });
        
    }
};

const getInfoUserWithPlan = async(userId:unknown) => {
    try {
    // Ejecutar el query utilizando Sequelize
    console.log("user id pasado por parámetro");
    console.log(userId);
    const queryResult = await db.query(
      `SELECT u.*, s.id_plan_alimenticio, p.nombre nombre_plan
       FROM usuarios u
       INNER JOIN suscripciones s ON u.id = s.id_usuario
       INNER JOIN planes_alimenticios p ON s.id_plan_alimenticio = p.id
       WHERE s.id_usuario = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    );

    console.log(JSON.stringify(queryResult))

    return queryResult;
    
  } catch (error) {
    console.error('Error al ejecutar el query:', error);
    
  }
}