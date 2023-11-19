import { Request, Response } from "express";
import AlimentosComidas from "../models/alimentos_comidas";
import Comida from "../models/comida";

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

export const crearComidaConAlimentos = async (
  req: Request,
  res: Response
) => {
  const { nombre, tipo, alimentos } = req.body;

  try {
    //Creando comida
    const nuevaComida = await Comida.create({
      nombre,
      tipo,
    });

    // Obtiene el id de la comida recién creada
    const comidaId = nuevaComida.id;

    //Una vez generada la comida, se procede a guardar en la tabla que relaciona a los alimentos con la comida
    await Promise.all(
      alimentos.map(async (alimento) => {
        const bodyRelacion = {
          id_comida: comidaId,
          id_alimento: alimento.id_alimento,
          cantidad: alimento.cantidad,
          id_catalogo_porcion_tipos: alimento.id_catalogo_porcion_tipos,
        };
        const relacion = new AlimentosComidas(bodyRelacion);
        await relacion.save();
      })
    );

    res.json({nuevaComida});
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
