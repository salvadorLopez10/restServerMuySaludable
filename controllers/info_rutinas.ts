import { Request, Response } from "express";
import Rutinas from "../models/info_rutinas";

export const getRecordsRutinas = async (req: Request, res: Response) => {
  const recordsRutinas = await Rutinas.findAll();
  res.json({ recordsRutinas });
};

export const getRecordRutinas = async (req: Request, res: Response) => {
  const { id } = req.params;

  const record = await Rutinas.findByPk(id);

  if (record) {
    res.json({ record });
  } else {
    res.status(404).json({
      msg: `No exite el registro con el id ${id}`,
    });
  }
};

export const postRutinas = async (req: Request, res: Response) => {
  const { body } = req;

  try {

    console.log("BODY Rutinas");
    console.log( body );

    const rutinaCreada = await Rutinas.create({
        titulo: body.titulo,
        dias: body.dias,
        descripcion: body.descripcion,
        video_url: body.video_url,
        image_url: body.image_url,
        nivel: body.nivel,
        activo: body.activo,
    });

    res.json(rutinaCreada);

  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "Error: Contacte al administrador",
    });
  }
};

