import { Request, Response } from "express";
import Carousel from "../models/carousel_images";

export const getRecordsCarousel = async (req: Request, res: Response) => {
  const recordsCarousel = await Carousel.findAll();
  res.json({ recordsCarousel });
};

export const getRecordCarousel = async (req: Request, res: Response) => {
  const { id } = req.params;

  const record = await Carousel.findByPk(id);

  if (record) {
    res.json({ record });
  } else {
    res.status(404).json({
      msg: `No exite el registro con el id ${id}`,
    });
  }
};

export const getRecordsCarouselByType = async (req: Request, res: Response) => {
    const { tipo } = req.params;
    console.log(req.params);

    const records = await Carousel.findAll({
        where: {
            tipo: tipo
        }
    }); 
  
    if (records && records.length > 0) {
      res.json({ records });

    } else {
      res.status(404).json({
        msg: `No hay registros con el tipo ${tipo}`,
      });
    }
  };

export const postCarousel = async (req: Request, res: Response) => {
  const { body } = req;

  try {

    console.log("BODY CAROUSEL");
    console.log( body );

    const carousel = await Carousel.create({
        titulo: body.titulo,
        image_url: body.tipo,
        tipo: body.tipo,
        activo: body.activo
    });

    res.json(carousel);

  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "Error: Contacte al administrador",
    });
  }
};

