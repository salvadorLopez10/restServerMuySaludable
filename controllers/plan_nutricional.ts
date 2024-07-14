import { Request, Response } from "express";
import db from "../db/connection";
import { QueryTypes } from "sequelize";
import Plan_Nutricional from "../models/plan_nutricional";

export const getPlanNutricionalByIdUsuario = async (req: Request, res: Response) => {

    const { idUser } = req.params;

    try{
        const plan = await Plan_Nutricional.findOne({
            where: {
                id_usuario: idUser,
                activo: 1
            }
        });

        if( plan ){
            res.status(200).json({
                status: `Ok`,
                msg: "El plan se ha obtenido correctamente",
                data: plan
            });

        }else{
            res.status(200).json({
                status: `no_results`,
                msg: "No se ha obtenido un plan ACTIVO relacionado al usuario con el id "+idUser,
                data: []
            });
        }

    }catch (error) {
        console.log(error);
        res.status(500).json({
            status: "Error",
            msg: "Error: Contacte al administrador",
            data: error
        });
    }

};

export const creaPlanNutricional = async (req: Request, res: Response) => {
    const { body } = req;

    try {
        const plan = await Plan_Nutricional.create({
            nombre: body.nombre,
            id_usuario: body.id_usuario,
            activo: body.activo,
            contenido: body.contenido
        });

        res.status(200).json({
            status: `Ok`,
            msg: "El plan generado se ha guardado correctamente",
            data: plan
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: "Error",
            msg: "Error: Contacte al administrador",
            data: error
        });
    }
};

export const updatePlanNutricional = async (req: Request, res: Response) => {
  
    const { id } = req.params;
    const { body } = req;

    try {

       const plan = await Plan_Nutricional.findByPk( id );
       if( !plan ){
        return res.status(404).json({
            status: "Error",
            msg: `No existe un plan nutricional con el id ${id}`,
            data: []
        });
       }

       await plan.update( {
        nombre: body.nombre,
        contenido: body.contenido,
        activo: body.activo
       } );

       res.status(200).json({
        status: `Ok`,
        msg: "El plan se ha actualizado correctamente",
        data: plan
    });
       
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "Error: Contacte al administrador"
        });
        
    }
};
