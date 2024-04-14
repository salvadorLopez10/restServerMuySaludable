import { Request, Response } from "express";
import Config from "../models/config";

export const getKeyStripeClient = async (req: Request, res: Response) => {

  try {

        const configStripe = await Config.findOne({
            where: {
                nombre: "stripe_client"
            }
        }); 

        if ( configStripe ){
            
            return res.status(200).json({
                status:"Success",
                msg: "Se ha obtenido correctamente el valor",
                data: configStripe.get("valor"),
            });

        }else{

            return res.status(200).json({
                status:"Success",
                msg: "El valor stripe_client no existe en la tabla Config",
                data: "",
            });
        }

        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: `Error`,
            msg: "Error: " + JSON.stringify(error,null,2)
        });

    }
};
