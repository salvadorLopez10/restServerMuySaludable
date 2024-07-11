import { Request, Response } from "express";
import db from "../db/connection";
import { QueryTypes } from "sequelize";
import Plan_Nutricional from "../models/plan_nutricional";

export const getPlanNutricionalByIdUsuario = async (req: Request, res: Response) => {

    const { idUser } = req.params;

    try{
        const plan = await Plan_Nutricional.findOne({
            where: {
                id_usuario: idUser
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
                msg: "No se ha obtenido un plan relacionado al usuario con el id "+idUser,
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
