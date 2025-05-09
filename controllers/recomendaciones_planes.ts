import { Request, Response } from "express";
import Recomendaciones from "../models/recomendaciones_planes";

export const getRecomendaciones = async (req: Request, res: Response) => {
  const recomendaciones = await Recomendaciones.findAll();
  res.json({ recomendaciones });
};

export const getRecomendacion = async (req: Request, res: Response) => {
  const { id } = req.params;

  const record = await Recomendaciones.findByPk(id);

  if (record) {
    res.json({ record });
  } else {
    res.status(404).json({
      msg: `No exite el registro con el id ${id}`,
    });
  }
};

export const postRecomendacion = async (req: Request, res: Response) => {
  const { body } = req;

  try {

    console.log("BODY Recomnendaciones");
    console.log( body );

    const rutinaCreada = await Recomendaciones.create({
        objetivo: body.objetivo,
        titulo: body.titulo,
        descripcion: body.descripcion,
        image_url: body.image_url,
        orden: body.orden,
        visible: body.visible,
    });

    res.json(rutinaCreada);

  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "Error: Contacte al administrador",
    });
  }
};

