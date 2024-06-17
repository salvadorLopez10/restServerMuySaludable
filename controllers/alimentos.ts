import { Request, Response } from "express";
import Alimento from "../models/alimento";

export const getAlimentos = async (req: Request, res: Response) => {
  const alimentos = await Alimento.findAll({
      order: [
        ['nombre', 'ASC'] // Ordenar alfabéticamente por nombre en orden ascendente
      ]
    });
  res.json({ alimentos });
};

export const getAlimento = async (req: Request, res: Response) => {
  const { id } = req.params;

  const alimento = await Alimento.findByPk(id);

  if (alimento) {
    res.json({ alimento });
  } else {
    res.status(404).json({
      msg: `No exite el alimento con el id ${id}`,
    });
  }

  // res.json({
  //     msg: "getUsuario",
  //     id
  // });
};

export const postAlimento = async (req: Request, res: Response) => {
  const { body } = req;

  try {
    const existeAlimento = await Alimento.findOne({
      where: {
        nombre: body.nombre,
      },
    });

    if (existeAlimento) {
      return res.status(400).json({
        msg: "Ya existe un alimento con el nombre " + body.nombre,
      });
    }

    console.log("BODY ALIMENTO");
    console.log( body );

    const alimento = await Alimento.create({
      nombre: body.nombre,
      tipo: body.tipo,
      informacion_nutrimental: ""
    });

    // const alimento = new Alimento();
    // await alimento.save();

    res.json(alimento);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "Error: Contacte al administrador",
    });
  }
};

