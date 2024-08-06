import { Request, Response } from "express";
import Suscripcion from '../models/suscripcion';

export const getSuscripciones = async (req: Request, res: Response) => {
  const suscripciones = await Suscripcion.findAll();

  // res.json({
  //     msg: 'getUsuarios'
  // })
  res.json({ suscripciones });
};

export const getSuscripcion = async (req: Request, res: Response) => {
  const { id } = req.params;

  const suscripcion = await Suscripcion.findByPk(id);

  if (suscripcion) {
    res.status(200).json({
        status: `Ok`,
        msg: "La suscripción "+id+" se ha obtenido correctamente",
        data: suscripcion
    });

  } else {
    res.status(404).json({
      msg: `No exite la suscripción con el id ${id}`,
    });
  }

};

export const postSuscripcion = async (req: Request, res: Response) => {
  const { body } = req;

  try {

    const suscripcion = await Suscripcion.create({
      id_usuario : body.id_usuario,
      id_plan_alimenticio: body.id_plan_alimenticio,
      id_pago: body.id_pago,
      fecha_expiracion: body.fecha_expiracion,
      estado: body.estado
    });

    res.status(200).json({
        status: `Ok`,
        msg: "La suscripción se ha creado correctamente",
        data: suscripcion
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
        status: "Error",
        msg: "Error: Contacte al administrador",
    });
  }
};

export const updateSuscripcion = async (req: Request, res: Response) => {
  
    const { id } = req.params;
    const { body } = req;

    try {

       const suscripcion = await Suscripcion.findByPk( id );
       if( !suscripcion ){
        return res.status(404).json({
            msg: 'No existe suscripción con el id ' + id 
        });
       }

       await suscripcion.update( {
        estado:body.estado,
        fecha_compra: body.fecha_compra
       } );

       res.status(200).json({
            status: `Ok`,
            msg: "La suscripción se ha actualizado correctamente",
            data: suscripcion
        });
       
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "Error: Contacte al administrador"
        });
        
    }
};
