import { Request, Response } from "express";
import Catalogo from "../models/catalogo_porcion_tipo";

export const getElementosCatalogo = async (req: Request, res: Response) => {
  const elementos = await Catalogo.findAll();

  // res.json({
  //     msg: 'getUsuarios'
  // })
  res.json({ elementos });
};

export const getElementoCatalogo = async (req: Request, res: Response) => {
  const { id } = req.params;

  const elemento = await Catalogo.findByPk(id);

  if (elemento) {
    res.json({ elemento });
  } else {
    res.status(404).json({
      msg: `No exite el elemento con el id ${id}`,
    });
  }

  // res.json({
  //     msg: "getUsuario",
  //     id
  // });
};