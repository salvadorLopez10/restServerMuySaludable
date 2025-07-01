import { Request, Response } from "express";
import { Op } from 'sequelize';
import Carousel from "../models/carousel_images";

export const getRecordsCarousel = async (req: Request, res: Response) => {
  const recordsCarousel = await Carousel.findAll({
      order: [['vigente_fecha_inicio', 'ASC']]
    });
    res.json({ recordsCarousel });
};

// Función para obtener registros activos según la fecha actual
export const getActiveRecordsCarousel = async (req: Request, res: Response) => {
  try {
    const fechaActual = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    
    const recordsCarousel = await Carousel.findAll({
      where: {
        activo: true,
        fecha_inicio: {
          [Op.lte]: fechaActual // Menor o igual a la fecha actual
        },
        fecha_fin: {
          [Op.gte]: fechaActual // Mayor o igual a la fecha actual
        }
      },
      order: [['id', 'ASC']]
    });
    
    res.json({ recordsCarousel });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener registros activos del carousel' });
  }
};

export const getRecordsCarouselByType = async (req: Request, res: Response) => {
    const { tipo } = req.params;
    const fechaActual = new Date().toISOString().split('T')[0];
    console.log('Fecha actual:', fechaActual);

    const records = await Carousel.findAll({
        where: {
          activo: true,
          tipo: tipo,
          vigente_fecha_inicio: {
            [Op.lte]: fechaActual
          },
          vigente_fecha_fin: {
            [Op.gte]: fechaActual
          }
        },
        order: [['id', 'ASC']]
    }); 
  
    if (records && records.length > 0) {
      res.json({ records });

    } else {
      res.status(404).json({
        msg: `No hay registros que cumplan con el tipo: ${tipo} y las fechas vigentes`,
      });
    }
  };

// Función para crear nuevo registro con validación de fechas
export const createCarouselRecord = async (req: Request, res: Response) => {
  try {
    const { titulo, image_url, tipo, activo, vigente_fecha_inicio, vigente_fecha_fin } = req.body;
    
    // Validar que fecha_fin sea mayor que fecha_inicio
    if (new Date(vigente_fecha_fin) <= new Date(vigente_fecha_inicio)) {
      return res.status(400).json({ 
        error: 'La fecha de fin debe ser posterior a la fecha de inicio' 
      });
    }
    
    const newRecord = await Carousel.create({
      titulo,
      image_url,
      tipo,
      activo,
      vigente_fecha_inicio,
      vigente_fecha_fin
    });
    
    res.status(201).json({ 
      message: 'Registro creado exitosamente', 
      record: newRecord 
    });
  } catch (error) {
    console.error('Error al crear registro del carousel:', error);
    res.status(500).json({ error: 'Error al crear registro del carousel' });
  }
};

// Función para obtener registros programados (próximos a activarse)
export const getScheduledRecordsCarousel = async (req: Request, res: Response) => {
  try {
    const fechaActual = new Date().toISOString().split('T')[0];
    
    const recordsCarousel = await Carousel.findAll({
      where: {
        activo: true,
        fecha_inicio: {
          [Op.gt]: fechaActual // Mayor que la fecha actual (futuros)
        }
      },
      order: [['fecha_inicio', 'ASC']]
    });
    
    res.json({ recordsCarousel });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener registros programados' });
  }
};