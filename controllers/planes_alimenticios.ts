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