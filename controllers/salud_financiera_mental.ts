import { Request, Response } from "express";
import Salud from "../models/salud_financiera_mental";

export const getSaludMental = async (req: Request, res: Response) => {

  try {

        const salud_mental = await Salud.findOne({
            where: {
                nombre: "Mental"
            }
        }); 

        if ( salud_mental ){
            
            return res.status(200).json({
                status:"Success",
                msg: "Se ha obtenido correctamente el contenido de salud mental",
                data: salud_mental.get("contenido"),
            });

        }else{

            return res.status(200).json({
                status:"Success",
                msg: "No se ha obtenido contenido para salud mental",
                data: "",
            });
        }

        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: `Error Salud Mental`,
            msg: "Error: " + JSON.stringify(error,null,2)
        });

    }
};

export const getSaludFinanciera = async (req: Request, res: Response) => {

  try {

        const salud_financiera = await Salud.findOne({
            where: {
                nombre: "Financiera"
            }
        }); 

        if ( salud_financiera ){
            
            return res.status(200).json({
                status:"Success",
                msg: "Se ha obtenido correctamente el contenido de salud financiera",
                data: salud_financiera.get("contenido"),
            });

        }else{

            return res.status(200).json({
                status:"Success",
                msg: "No se ha obtenido contenido para salud financiera",
                data: "",
            });
        }

        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: `Error Salud Financiera`,
            msg: "Error: " + JSON.stringify(error,null,2)
        });

    }
};
