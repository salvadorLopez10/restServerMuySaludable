import { Request, Response } from "express";
import Comida from '../models/comida';

export const getComidas = async (req: Request, res: Response) => {
  const comidas = await Comida.findAll();

  // res.json({
  //     msg: 'getUsuarios'
  // })
  res.json({ comidas });
};

export const getComida = async (req: Request, res: Response) => {
  const { id } = req.params;

  const comida = await Comida.findByPk(id);

  if (comida) {
    res.json({ comida });
  } else {
    res.status(404).json({
      msg: `No exite la comida con el id ${id}`,
    });
  }

  // res.json({
  //     msg: "getUsuario",
  //     id
  // });
};

export const postComida = async (req: Request, res: Response) => {
  const { body } = req;

  try {

    const comida = new Comida(body);
    await comida.save();

    res.json(comida);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "Error: Contacte al administrador",
    });
  }
};
