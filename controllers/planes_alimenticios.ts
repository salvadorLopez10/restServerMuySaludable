import { Request, Response } from "express";
import Planes_Alimenticios from "../models/planes_alimenticio";

export const getAllPlans = async (req: Request, res: Response) => {
  const elementos = await Planes_Alimenticios.findAll();
  res.json({ elementos });
};

export const getPlanById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const plan = await Planes_Alimenticios.findByPk(id);

  if (plan) {
    res.json({ plan });
  } else {
    res.status(404).json({
      msg: `No existe el plan alimenticio con el id ${id}`,
    });
  }
};

export const updatePlanAlimenticio = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nombre, resumen, descripcion_detallada, duracion_meses, precio, precio_regular } = req.body;

    try {
        const plan = await Planes_Alimenticios.findByPk(id);

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: `No existe plan con id ${id}`
            });
        }

        await plan.update({
            nombre,
            resumen,
            descripcion_detallada,
            duracion_meses,
            precio,
            precio_regular
        });

        res.json({
            status: "Ok",
            msg: "Plan alimenticio actualizado",
            data: plan
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};