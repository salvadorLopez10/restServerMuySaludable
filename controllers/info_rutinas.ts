import { Request, Response } from "express";
import Rutinas from "../models/info_rutinas";

export const getRecordsRutinas = async (req: Request, res: Response) => {
  const recordsRutinas = await Rutinas.findAll({
      where: {
        activo: true,
      },
      order: [['id', 'ASC']]
    });

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

// Nueva función para desactivar rutinas existentes por título y nivel, y crear una nueva, para que de esta manera, solo exista un video activo por cada nivel y título
export const inactiveAndSaveRutinaPerTitle = async (req: Request, res: Response) => {
  const { body } = req;

  try {
    // Antes de crear una nueva rutina, desactivar las existentes con el mismo título
    const records = await Rutinas.findAll({
      where: {
        titulo: body.titulo,
        nivel: body.nivel,
        activo: 1,
      },
      order: [['id', 'ASC']]
    });
    
    if (records.length > 0) {
      //Actualizar los registros existentes para desactivarlos
      await Rutinas.update(
        { activo: 0 },
        {
          where: {
            titulo: body.titulo,
            nivel: body.nivel,
            activo: true,
          }
        }
      );
      console.log(`Desactivados ${records.length} registros con el título: ${body.titulo}`);

    } else {
      console.log(`No se encontraron registros activos con el título: ${body.titulo}`);
    }
    // Crear una nueva rutina
    const rutinaCreada = await Rutinas.create({
        titulo: body.titulo,
        dias: body.dias,
        descripcion: body.descripcion,
        video_url: body.video_url,
        image_url: body.image_url,
        nivel: body.nivel,
        activo: body.activo ?? 1, // Por defecto activo
    });

    res.json(rutinaCreada);

  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "Error: Contacte al administrador",
    });
  }
}