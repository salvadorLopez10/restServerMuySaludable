import { Request, Response } from "express";
import AlimentosComidas from "../models/alimentos_comidas";

export const getAlimentosComidas = async (req: Request, res: Response) => {
  const alimentosComidas = await AlimentosComidas.findAll();

  // res.json({
  //     msg: 'getUsuarios'
  // })
  res.json({ alimentosComidas });
};

export const getAlimentoComidas = async (req: Request, res: Response) => {
  const { id } = req.params;

  const alimentoComidas = await AlimentosComidas.findByPk(id);

  if (alimentoComidas) {
    res.json({ alimentoComidas });
  } else {
    res.status(404).json({
      msg: `No exite la relación entre comidas y alimentos con el id ${id}`,
    });
  }

  // res.json({
  //     msg: "getUsuario",
  //     id
  // });
};

export const postRelacionAlimentosComidas = async (req: Request, res: Response) => {
  const { body } = req;

  try {
    
    const relacion = new AlimentosComidas(body);
    await relacion.save();

    res.json(relacion);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "Error: Contacte al administrador",
    });
  }
};

export const putUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { body } = req;

  try {
    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({
        msg: "No existe un usuario con el id " + id,
      });
    }

    await usuario.update(body);

    res.json(usuario);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "Error: Contacte al administrador",
    });
  }
};

export const deleteUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;

  const usuario = await Usuario.findByPk(id);
  if (!usuario) {
    return res.status(404).json({
      msg: "No existe un usuario con el id " + id,
    });
  }

  //Eliminación fisica
  //await usuario.destroy();
  await usuario.update({ estado: false });

  res.json(usuario);

  // res.json({
  //     msg: "deleteUsuario",
  //     id
  // });
};
