import { Request, Response } from "express";
import { Op } from 'sequelize';
import Salud from "../models/salud_financiera_mental";

export const getSaludMental = async (req: Request, res: Response) => {

  try {
        const fechaActual = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
        const salud_mental = await Salud.findOne({
            where: {
                nombre: "Mental",
                vigente_fecha_inicio: {
                    [Op.lte]: fechaActual // Menor o igual a la fecha actual
                },
                vigente_fecha_fin: {
                    [Op.gte]: fechaActual // Mayor o igual a la fecha actual
                }
            },
            order: [['createdAt', 'DESC']] // Ordenar por fecha de creación descendente
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
        const fechaActual = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
        const salud_financiera = await Salud.findOne({
            where: {
                nombre: "Financiera",
                vigente_fecha_inicio: {
                    [Op.lte]: fechaActual // Menor o igual a la fecha actual
                },
                vigente_fecha_fin: {
                    [Op.gte]: fechaActual // Mayor o igual a la fecha actual
                }
            },
            order: [['createdAt', 'DESC']] // Ordenar por fecha de creación descendente
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

export const createSaludRecord = async (req: Request, res: Response) => {
  try {
    const { nombre, contenido, vigente_fecha_inicio, vigente_fecha_fin } = req.body;
    
    // Validar que fecha_fin sea mayor que fecha_inicio
    if (new Date(vigente_fecha_fin) <= new Date(vigente_fecha_inicio)) {
      return res.status(400).json({ 
        error: 'La fecha de fin debe ser posterior a la fecha de inicio' 
      });
    }
    
    const newRecord = await Salud.create({
      nombre,
      contenido,
      vigente_fecha_inicio,
      vigente_fecha_fin
    });
    
    res.status(201).json({ 
      message: 'Registro creado exitosamente', 
      record: newRecord 
    });
  } catch (error) {
    console.error('Error al crear registro del carousel:', error);
    res.status(500).json({ error: 'Error al crear registro del carousel' });
  }
};
