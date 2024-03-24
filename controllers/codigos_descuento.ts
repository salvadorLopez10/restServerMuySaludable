import { Request, Response } from "express";
import Codigo from '../models/codigos_descuento';

export const getCodigos = async (req: Request, res: Response) => {
  const codigos = await Codigo.findAll();

  res.status(200).json({
        status: `Ok`,
        msg: "Los códigos de descuento se han obtenido correctamente",
        data: codigos
    });
};

export const getCodigoById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const codigo = await Codigo.findByPk(id);

  if (codigo) {
    res.status(200).json({
        status: `Ok`,
        msg: "El código de descuento se ha obtenido correctamente",
        data: codigo
    });

  } else {
    res.status(404).json({
        status: `No encontrado`,
        msg: `No exite el código de descuento con el id ${id}`,
        data: ''
    });
  }
};

export const getCodigoByName = async (req: Request, res: Response) => {
  const { nombre } = req.params;

  const codigo = await Codigo.findOne({
    where: {
        nombre: nombre,
        activo: 1
    }
  });

  console.log(JSON.stringify(codigo,null,2))

  if (codigo) {
    res.status(200).json({
        status: `Ok`,
        msg: "El código de descuento se ha obtenido correctamente",
        data: codigo
    });

  } else {
    res.status(404).json({
        status: `No encontrado`,
        msg: `No existe el código de descuento con el nombre ${nombre} o se encuentra inactivo`,
        data: ''
    });
  }
};

export const createCodigo = async (req: Request, res: Response) => {
  const { body } = req;
 
  try {
     const codigo = await Codigo.create({
      nombre : body.nombre,
      valor: body.valor,
      vigencia:  new Date(body.vigencia).toISOString()
    });

    res.status(200).json({
        status: `Ok`,
        msg: "El código de descuento se ha creado correctamente",
        data: codigo
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
        status: "Error",
        msg: "Error: Contacte al administrador "+ JSON.stringify(error),
        data:''
    });
  }
};
