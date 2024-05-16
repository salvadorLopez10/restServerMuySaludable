import { Request, Response } from "express";
import Usuario from '../models/usuario';
import { QueryTypes, Sequelize } from "sequelize";
import db from "../db/connection";


export const getUsuarios = async ( req: Request, res: Response ) => {

    const usuarios = await Usuario.findAll();

    res.json({usuarios});

}

export const getUsuario = async (req: Request, res: Response) => {

    const { id } = req.params;

    const usuario = await Usuario.findByPk(id);

    if( usuario ){
        res.json({ usuario });
    }else{
        res.status(404).json({
            msg: `No existe un usuario con el id ${id}`
        });
    }
};

export const postUsuario = async (req: Request, res: Response) => {
  
    const { body } = req;

    try {

        const existeEmail = await Usuario.findOne({
            where: {
                email: body.email
            }
        }); 

        if ( existeEmail ){
            return res.status(200).json({
                status:"Duplicate",
                msg: "Ya existe un usuario con el email "+ body.email,
                data: "",
            });
        }

        const usuario = await Usuario.create({
            email: body.email,
            //password: body.password
        });

        res.status(200).json({
            status: `Ok`,
            msg: "El usuario se ha creado correctamente",
            data: usuario
        });
        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: `Error`,
            msg: "Error: Contacte al administrador"
        });
        
    }

    
};

export const putUsuario = async (req: Request, res: Response) => {
  
    const { id } = req.params;
    const { body } = req;

    try {

       const usuario = await Usuario.findByPk( id );
       if( !usuario ){
        return res.status(404).json({
            msg: 'No existe un usuario con el id ' + id 
        });
       }


       await usuario.update( {
        nombre: body.nombre,
        email: body.email,
        password: body.password,
        edad: body.edad,
        altura: body.altura,
        peso: body.peso,
        sexo: body.sexo,
        actividad_fisica: body.actividad_fisica,
        tipo_dieta: body.tipo_dieta,
        alimentos_evitar: body.alimentos_evitar,
        objetivo: body.objetivo,
        estado_mexico: body.estado_mexico,
        notification_token: body.notification_token,
        deleted: body.deleted
       } );

       res.status(200).json({
            status: `Ok`,
            msg: "El usuario se ha actualizado correctamente",
            data: usuario
        });
       
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "Error: Contacte al administrador"
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
    await usuario.update({estado: false});


    res.json(usuario);

    // res.json({
    //     msg: "deleteUsuario",
    //     id
    // });
};

export const emailExists = async (req: Request, res: Response) => {
  const { body } = req;

    try {

        const existeEmail = await Usuario.findOne({
            where: {
                email: body.email
            }
        }); 

        if ( existeEmail ){
            
            return res.status(200).json({
                status:"Duplicate",
                msg: "Ya existe un usuario con el email "+ body.email,
                data: existeEmail,
            });

        }else{

            return res.status(200).json({
                status:"Ok",
                msg: "Email no existente",
                data: "",
            });
        }

        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: `Error`,
            msg: "Error: Contacte al administrador"
        });

    }
};

export const login = async (req: Request, res: Response) => {
  const { body } = req;

    try {

        const existeUsuario = await Usuario.findOne({
            where: {
                email: body.email,
                password: body.password
            }
        }); 

        if ( existeUsuario ){
            
            if( existeUsuario.get('deleted') ){
                return res.status(200).json({
                    status:"Error",
                    msg: "Login incorrecto, el usuario ha eliminado su cuenta",
                    data: existeUsuario,
                });
                
            }

            const infoComplete = await getInfoUserWithPlan(existeUsuario.get('id'))

            return res.status(200).json({
                status:"Ok",
                msg: "Login correcto",
                data: (infoComplete) ? infoComplete[0]: "",
            });

        }else{

            return res.status(200).json({
                status:"Error",
                msg: "Correo y/o contraseña incorrecto(s)",
                data: "",
            });
        }

        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: `Error`,
            msg: "Error: Contacte al administrador"
        });
        
    }
};

export const calculateTMB = async (req: Request, res: Response) => {

    const { id } = req.params;
    
    try {
        const usuario = await Usuario.findByPk(id);
        if(usuario){

            const edad = usuario.get('edad');
            const altura = usuario.get('altura');
            const sexo = usuario.get('sexo');
            const peso = usuario.get('peso');
            const nivel_actividad = usuario.get('actividad_fisica');
            
            const tasa_metabolica_basal = getTMB( edad, peso, sexo, altura );

            const tasa_metabolica_basal_actividad = getTMBbyActividad( tasa_metabolica_basal, nivel_actividad );

            await usuario.update({
                tmb: tasa_metabolica_basal_actividad
            });

            return res.status(200).json({
                status:"Ok",
                msg: "Tasa metabólica basal calculada correctamente para el usuario "+ id,
                data: number_format(tasa_metabolica_basal_actividad),
            });

        }else{
            return res.status(200).json({
                status:"Not Found",
                msg: `No existe un usuario con el id ${id}`,
                data: "",
            });
        }

        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: `Error`,
            msg: "Error: Contacte al administrador",
            data: error
        });
        
    }
};

const getInfoUserWithPlan = async(userId:unknown) => {
    try {
    // Ejecutar el query utilizando Sequelize
    console.log("user id pasado por parámetro");
    console.log(userId);
    const queryResult = await db.query(
       `SELECT u.*, s.id_plan_alimenticio,s.estado estado_plan, p.nombre nombre_plan, p.duracion_meses, s.fecha_expiracion
       FROM usuarios u
       INNER JOIN suscripciones s ON u.id = s.id_usuario
       INNER JOIN planes_alimenticios p ON s.id_plan_alimenticio = p.id
       WHERE s.estado = 'Activo'
       AND s.id_usuario = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    );

    console.log(JSON.stringify(queryResult))

    return queryResult;

  } catch (error) {
    console.error('Error al ejecutar el query:', error);
    
  }
}

const getTMB = ( edad: string | unknown, peso: string | unknown, sexo: string | unknown, altura: string | unknown ) => {
    var tmb = null;

    /*
        ---Hombres
        TMB = (10 x peso en kg) + (6,25 × altura en cm) - (5 × edad en años) + 5
        ---Mujeres
        TMB = (10 x peso en kg) + (6,25 × altura en cm) - (5 × edad en años) - 161
    */

    if( sexo == "Hombre" ){
        tmb= ( 10 * Number(peso) ) + ( 6.25 * Number(altura) )- (5 * Number(edad) )+ 5; 
    }else{
        tmb = ( 10 * Number(peso) ) + (6.25 * Number(altura)) - ( 5 * Number(edad)) - 161;
    }

    return tmb;

}

const getTMBbyActividad = ( tmb: number, actividad: string | unknown ) => {

    var tmba = null;

    switch (actividad) {
        case "poco_ninguno":
            tmba = tmb * 1.2;
            break;
        
        case "ligero":
            tmba = tmb * 1.375;
            break;

        case "moderado":
            tmba = tmb * 1.55;
            break;
        
        case "fuerte":
            tmba = tmb * 1.725;
            break;
        
        case "muy_fuerte":
            tmba = tmb * 1.9;
            break;
    
        default:
            tmba = 0;
            break;
    }

    return tmba;
}

function number_format(n : number) {
    
    return n.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, "$1");
}

export const generateMealPlan = (req: Request, res: Response) => {

    const { body } = req;

    const duracion = body.duracion;
    const tipo_dieta = body.tipo_dieta;
    const alimentos_evitar = body.alimentos_evitar;
    const objetivo = body.objetivo;
    const tmb = body.tmb;

    const json_response = {
    "Detox": {
      "Desayuno": {
        "Opcion 1": "Huevos al gusto",
        "Opcion 2": "Sincronizadas",
        "Opcion 3": "Enchiladas",
      },
      "Colación 1": {
        "Opcion 1": "Opcion 1",
        "Opcion 2": "Opcion 2",
      },
      "Colación 2": {
        "Opcion 1": "Opcion 1",
        "Opcion 2": "Opcion 2",
      },
    },
    "Mes 1": {
      "Desayuno": {
        "Opcion 1": "Opcion 1",
        "Opcion 2": "Opcion 2",
      },
      "Colación 1": {
        "Opcion 1": "Opcion 1",
        "Opcion 2": "Opcion 2",
      },
      "Colación 2": {
        "Opcion 1": "Opcion 1",
        "Opcion 2": "Opcion 2",
      },
    },
    "Mes 2": {
      "Desayuno": {
        "Opcion 1": "Opcion 1",
        "Opcion 2": "Opcion 2",
      },
      "Colación 1": {
        "Opcion 1": "Opcion 1",
        "Opcion 2": "Opcion 2",
      },
      "Colación 2": {
        "Opcion 1": "Opcion 1",
        "Opcion 2": "Opcion 2",
      },
    },
  };

    return res.status(200).json({
                status:"Ok",
                msg: "Plan generado ",
                data: json_response
            });

}