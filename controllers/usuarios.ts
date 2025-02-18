import { Request, Response } from "express";
import Usuario from '../models/usuario';
import { QueryTypes, Sequelize, json, Op } from "sequelize";
import db from "../db/connection";
import { Ingredient, JSONResponse, Meal, MealGroup, MealPlan, TipoComida } from "./interfaces";
import OpenAI from "openai";
import NuevoAlimento from "../models/nuevos_alimentos";

type Alimento = {
    id: number;
    nombre: string;
    grupo: string;
    equivalente: number;
    unidad_medida: string;
    proteinas: number;
    lipidos: number;
    hco: number;
    kcal: number;
    tiempo_comida: string;
    categoria: string;
};
  
type OpcionTiempoComida = {
    opcion1: string[];
    opcion2: string[];
    opcion3: string[];
  };

type PlanAlimenticio = {
    desayuno: OpcionTiempoComida;
    comida: OpcionTiempoComida;
    cena: OpcionTiempoComida;
    colacion: OpcionTiempoComida;
};

type CuadroDietosintetico = {
    [grupo: string]: number;
};

// Definir un tipo para las claves de los grupos
type GrupoRequerido = 'Verduras' | 'Frutas' | 'Cereales' | 'Leguminosas';
  

type TiempoComida = 'desayuno' | 'colacion' | 'comida' | 'cena';

const distribucionPorComida = {
    Desayuno: ['Frutas', 'Cereales', 'Leche baja en grasa'],
    'Colación 1': ['Frutas', 'Grasa sin proteína', 'Alimentos libres de energía'],
    Comida: ['Verduras', 'Cereales', 'Alimentos de origen animal bajo en grasa'],
    'Colación 2': ['Frutas', 'Leguminosas', 'Grasa con proteína'],
    Cena: ['Verduras', 'Cereales', 'Alimentos de origen animal muy bajo en grasa'],
  };

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

        const usuarioData: Partial<{ email: string; password?: string }> = {
            email: body.email,
        };

        if( body.password ){
            usuarioData.password = body.password;
        }
        const usuario = await Usuario.create( usuarioData );

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
            
            if( infoComplete !== null ){
                return res.status(200).json({
                    status:"Ok",
                    msg: "Login correcto",
                    data: (infoComplete) ? infoComplete[0]: "",
                });
            }else{
                return res.status(200).json({
                    status:"Ok",
                    msg: "Sin suscripcion",
                    data: body.email,
                });
            }


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
       `SELECT u.*,s.id id_suscripcion, s.id_plan_alimenticio,s.estado estado_plan, p.nombre nombre_plan, p.duracion_meses, s.fecha_expiracion
       FROM usuarios u
       INNER JOIN suscripciones s ON u.id = s.id_usuario
       INNER JOIN planes_alimenticios p ON s.id_plan_alimenticio = p.id
       WHERE s.estado = 'Activo'
       AND s.id_usuario = :userId
       ORDER BY s.fecha_compra DESC`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    );

    console.log(JSON.stringify(queryResult))

    if( queryResult.length > 0 ){
        return queryResult;
    }else{
        return null;
    }

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
            tmba = tmb * 1.1;
            break;
        
        case "ligero":
            tmba = tmb * 1.2;
            break;

        case "moderado":
            tmba = tmb * 1.3;
            break;
        
        case "fuerte":
            tmba = tmb * 1.4;
            break;
        
        case "muy_fuerte":
            tmba = tmb * 1.5;
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

export const generateMealPlan = async(req: Request, res: Response) => {

    const { body } = req;

    const duracion = body.duracion;
    const tipo_dieta = body.tipo_dieta;
    const alimentos_evitar = body.alimentos_evitar;
    const objetivo = body.objetivo;
    const tmb = body.tmb;

    try {
    // Ejecutar el query utilizando Sequelize
        const queryComidas: Meal[] = await db.query<Meal>(
        `
        SELECT 
                c.id idComida,
                c.nombre nombreComida,
                c.tipo,
                c.categoria,
                c.detox,
                a.id idIngrediente,
                a.nombre nombreIngrediente,
                a.porcion porcionBase,
                a.tipo_porcion tipoPorcion,
                a.calorias caloriasBase
            FROM
                comidas c
                INNER JOIN alimentos_comidas ac ON ac.id_comida = c.id
                INNER JOIN alimentos a ON ac.id_alimento = a.id
            WHERE
                c.categoria = :tipo_dieta
        `,
        {
            replacements: { tipo_dieta },
            type: QueryTypes.SELECT,
        }
        );

        //console.log(JSON.stringify(queryComidas,null,1))
        //console.log(alimentos_evitar);

        const arrayComidasFormat  = formatMeals(queryComidas);

        const plan = generarPlanAlimenticio(objetivo,tmb, arrayComidasFormat, alimentos_evitar);

        //console.log(JSON.stringify(plan,null,1));

        return res.status(200).json({
                    status:"Ok",
                    msg: "Plan generado ",
                    //data: arrayComidasFormat
                    data: plan
                });

    } catch (error) {
        console.error('Error al ejecutar el query:', error);
        
    }

}

function formatMeals(meals: Meal[]): MealPlan {

    const mealPlan: MealPlan = {
        Desayunos: [],
        Colaciones: [],
        Comidas: [],
        Cenas: [],
    };

    const mealTypes: { [key: string]: keyof MealPlan } = {
        Desayuno: 'Desayunos',
        Colacion: 'Colaciones',
        Comida: 'Comidas',
        Cena: 'Cenas'
    };

    const groupedMeals: { [key: number]: MealGroup } = meals.reduce((acc: { [key: number]: MealGroup }, meal: Meal) => {
        if (!acc[meal.idComida]) {
            acc[meal.idComida] = {
                nombre: meal.nombreComida,
                tipo: meal.tipo,
                idComida: meal.idComida,
                detox: Number(meal.detox),
                ingredientes: [],
            };
        }
        acc[meal.idComida].ingredientes.push({
            nombre: meal.nombreIngrediente,
            porcionBase: meal.porcionBase,
            tipoPorcion: meal.tipoPorcion,
            caloriasPorcionBase: meal.caloriasBase
        });
        return acc;
    }, {});

    for (const id in groupedMeals) {
        if (groupedMeals.hasOwnProperty(id)) {
            const meal = groupedMeals[id];
            const mealType = meals.find(m => m.idComida === Number(id))?.tipo;
            // Validar si el tipo de comida existe en mealTypes
            if (mealType && mealTypes[mealType]) {
                mealPlan[mealTypes[mealType]].push(meal);
            } else {
                console.error(`Tipo de comida no encontrado: ${mealType} para la comida con id: ${id}`);
            }
        }
    }

    return mealPlan;

}

function ajustarCaloriasPorObjetivo(tmb: number, objetivo: string): number {
    switch (objetivo) {
        case 'Bajar de peso':
            //return tmb * 0.8; // Reducir en 20%
            return Number(tmb) - 500; // Reducir 500 kcal
        case 'Mantenimiento':
            return tmb; // Mismo que la TMB
        case 'Ganar masa muscular':
            //return tmb * 1.2; // Incrementar en 20%
            return Number(tmb) + 500; //  Aumentar 500 kcal
        default:
            throw new Error('Objetivo no válido');
    }
}

function ajustarPorciones(ingredientes: Ingredient[], caloriasObjetivoPorComida: number): Ingredient[] {

    const caloriasBaseTotal = ingredientes.reduce((total, ingrediente) => total + parseFloat(ingrediente.caloriasPorcionBase), 0);

    const factorAjuste = caloriasObjetivoPorComida / caloriasBaseTotal;

    return ingredientes.map(ingrediente => {
        const porcionAjustada = parseFloat(ingrediente.porcionBase) * factorAjuste;
        const caloriasAjustadas = parseFloat(ingrediente.caloriasPorcionBase) * factorAjuste;

        let porcionAjustadaRedondeada;
        switch (ingrediente.tipoPorcion) {
            case 'pieza':
            case 'cucharada':
            case 'hojas':
                porcionAjustadaRedondeada = Math.round(porcionAjustada);
                break;
            case 'gr':
                porcionAjustadaRedondeada = Number((Math.round(porcionAjustada / 5) * 5).toFixed(2));
                break;
            case 'ml':
                porcionAjustadaRedondeada = Math.round(porcionAjustada / 10) * 10;
                break;
            case 'taza':
                porcionAjustadaRedondeada = Math.round(porcionAjustada * 10) / 10;
                break;
            default:
                porcionAjustadaRedondeada = Number(Math.round(porcionAjustada).toFixed(2)); //Se redondea y máximos 2 decimales en caso de que el tipo no exista en la lista
        }

        return {
            ...ingrediente,
            porcionAjustada: porcionAjustadaRedondeada,
            caloriasAjustadas
        };
    });


}

function calcularCaloriasTotalesAjustadas(ingredientes: Ingredient[]): number {
    return ingredientes.reduce((acc, ingrediente) => acc + (ingrediente.caloriasAjustadas ?? 0), 0);
}

function seleccionarComidasSinRepeticion(comidas: MealGroup[], cantidad: number, alimentosAEvitar: string[], paraDetox: boolean): MealGroup[] {

    // const comidasFiltradas = alimentosAEvitar.length > 0
    //     ? comidas.filter(comida =>
    //         !comida.ingredientes.some(ingrediente => alimentosAEvitar.includes(ingrediente.nombre))
    //     )
    //     : comidas;

    const comidasFiltradas = comidas.filter(comida => {
        const noContieneAlimentosEvitar = !comida.ingredientes.some(ingrediente =>
          alimentosAEvitar.includes(ingrediente.nombre)
        );
        const esParaPlan = paraDetox ? comida.detox === 1 : comida.detox === 0;
        return noContieneAlimentosEvitar && esParaPlan;
    });

    const comidasSeleccionadas: MealGroup[] = [];
    const comidasDisponibles = [...comidasFiltradas];

    while (comidasSeleccionadas.length < cantidad && comidasDisponibles.length > 0) {
        const indiceAleatorio = Math.floor(Math.random() * comidasDisponibles.length);
        comidasSeleccionadas.push(comidasDisponibles.splice(indiceAleatorio, 1)[0]);
    }

    return comidasSeleccionadas;
}

function generarPlanAlimenticio(objetivo: string, tmb: string, planAlimenticio:MealPlan, alimentosEvitar: string[]) {
    
   const caloriasDiarias = ajustarCaloriasPorObjetivo(parseFloat(tmb), objetivo);

   console.log("Calorias TMB: "+ tmb);
   console.log("Calorias Ajustadas por objetivo: "+ caloriasDiarias);
   //console.log("PLAAAN");
   //console.log(JSON.stringify(planAlimenticio,null,2));
     // Porcentajes de calorías por cada tipo de comida (Aportación calórica por cada tipo de comida)
    const porcentajesCaloricos = {
        desayuno: 0.25,
        colacion1: 0.10,
        comida: 0.35,
        colacion2: 0.10,
        cena: 0.20
    };

    // Calorías objetivo por cada tipo de comida
    const caloriasDesayuno = caloriasDiarias * porcentajesCaloricos.desayuno;
    const caloriasColacion1 = caloriasDiarias * porcentajesCaloricos.colacion1;
    const caloriasComida = caloriasDiarias * porcentajesCaloricos.comida;
    const caloriasColacion2 = caloriasDiarias * porcentajesCaloricos.colacion2;
    const caloriasCena = caloriasDiarias * porcentajesCaloricos.cena;

    // const desayunosDetox = seleccionarComidasSinRepeticion(planAlimenticio.Desayunos, 5,alimentosEvitar,true);
    // const colaciones_1Detox = seleccionarComidasSinRepeticion(planAlimenticio.Colaciones, 5,alimentosEvitar,true);
    // const comidasDetox = seleccionarComidasSinRepeticion(planAlimenticio.Comidas, 5,alimentosEvitar,true);
    // const colaciones_2Detox = seleccionarComidasSinRepeticion(planAlimenticio.Colaciones, 5,alimentosEvitar,true);
    // const cenasDetox = seleccionarComidasSinRepeticion(planAlimenticio.Cenas, 5,alimentosEvitar,true);

    const [ desayunosDetox, colaciones_1Detox, comidasDetox, colaciones_2Detox, cenasDetox  ] = getComidasSinRepeticion( planAlimenticio, alimentosEvitar, true );
    
    //Comidas para mes 1
    const [ desayunosMes1, colaciones_1Mes1, comidasMes1, colaciones_2Mes1, cenasMes1  ] = getComidasSinRepeticion( planAlimenticio, alimentosEvitar, false );

    //Comidas para mes 2
    const [ desayunosMes2, colaciones_1Mes2, comidasMes2, colaciones_2Mes2, cenasMes2  ] = getComidasSinRepeticion( planAlimenticio, alimentosEvitar, false );

    const comidasSeleccionadasDetox = [
        { comidas: desayunosDetox, caloriasObjetivo: caloriasDesayuno, tipo: "Desayuno" },
        { comidas: colaciones_1Detox, caloriasObjetivo: caloriasColacion1, tipo: "Colación 1"},
        { comidas: comidasDetox, caloriasObjetivo: caloriasComida, tipo: "Comida"},
        { comidas: colaciones_2Detox, caloriasObjetivo: caloriasColacion2, tipo: "Colación 2"},
        { comidas: cenasDetox, caloriasObjetivo: caloriasCena, tipo: "Cena"}
    ];

    const comidasSeleccionadasMes1 = [
        { comidas: desayunosMes1, caloriasObjetivo: caloriasDesayuno, tipo: "Desayuno" },
        { comidas: colaciones_1Mes1, caloriasObjetivo: caloriasColacion1, tipo: "Colación 1"},
        { comidas: comidasMes1, caloriasObjetivo: caloriasComida, tipo: "Comida"},
        { comidas: colaciones_2Mes1, caloriasObjetivo: caloriasColacion2, tipo: "Colación 2"},
        { comidas: cenasMes1, caloriasObjetivo: caloriasCena, tipo: "Cena"}
    ];

    const comidasSeleccionadasMes2 = [
        { comidas: desayunosMes2, caloriasObjetivo: caloriasDesayuno, tipo: "Desayuno" },
        { comidas: colaciones_1Mes2, caloriasObjetivo: caloriasColacion1, tipo: "Colación 1"},
        { comidas: comidasMes2, caloriasObjetivo: caloriasComida, tipo: "Comida"},
        { comidas: colaciones_2Mes2, caloriasObjetivo: caloriasColacion2, tipo: "Colación 2"},
        { comidas: cenasMes2, caloriasObjetivo: caloriasCena, tipo: "Cena"}
    ];



    const comidasAjustadasDetox = comidasSeleccionadasDetox.map(({ comidas, caloriasObjetivo, tipo }) => {
        return comidas.map(comida => {
            const ingredientesAjustados = ajustarPorciones(comida.ingredientes, caloriasObjetivo);
            const caloriasTotalesAjustadas = calcularCaloriasTotalesAjustadas(ingredientesAjustados);
            return {
                ...comida,
                tipo: tipo,
                ingredientes: ingredientesAjustados,
                caloriasTotalesAjustadas: Math.round(caloriasTotalesAjustadas),
                
            };
        });
    }).flat();

    const comidasAjustadasMes1 = comidasSeleccionadasMes1.map(({ comidas, caloriasObjetivo, tipo }) => {
        return comidas.map(comida => {
            const ingredientesAjustados = ajustarPorciones(comida.ingredientes, caloriasObjetivo);
            const caloriasTotalesAjustadas = calcularCaloriasTotalesAjustadas(ingredientesAjustados);
            return {
                ...comida,
                tipo: tipo,
                ingredientes: ingredientesAjustados,
                caloriasTotalesAjustadas: Math.round(caloriasTotalesAjustadas),
                
            };
        });
    }).flat();

    const comidasAjustadasMes2 = comidasSeleccionadasMes2.map(({ comidas, caloriasObjetivo, tipo }) => {
        return comidas.map(comida => {
            const ingredientesAjustados = ajustarPorciones(comida.ingredientes, caloriasObjetivo);
            const caloriasTotalesAjustadas = calcularCaloriasTotalesAjustadas(ingredientesAjustados);
            return {
                ...comida,
                tipo: tipo,
                ingredientes: ingredientesAjustados,
                caloriasTotalesAjustadas: Math.round(caloriasTotalesAjustadas),
                
            };
        });
    }).flat();

     comidasAjustadasDetox.forEach(comida => {
            //console.log("COMIDAAA");
            //console.log(JSON.stringify(comida,null,2));
            console.log(`${comida.tipo}`);
            console.log(`Comida: ${comida.nombre}`);
            console.log(`Calorías Totales Ajustadas: ${comida.caloriasTotalesAjustadas}`);
            comida.ingredientes.forEach(ingrediente => {
                console.log(`- ${ingrediente.nombre}: ${ingrediente.porcionAjustada} ${ingrediente.tipoPorcion} (${ingrediente.caloriasAjustadas?.toFixed(2)} Calorías)`);
            });

        });

    // Formatear la salida en un objeto JSON
    const jsonResponse: JSONResponse = {
        Detox: {
            Desayuno: {},
            Colacion1: {},
            Comida: {},
            Colacion2: {},
            Cena: {}
        },
        Mes1: {
            Desayuno: {},
            Colacion1: {},
            Comida: {},
            Colacion2: {},
            Cena: {}
        },
        Mes2: {
            Desayuno: {},
            Colacion1: {},
            Comida: {},
            Colacion2: {},
            Cena: {}
        }
    };

    const maxOpciones = 5;
    const opcionesCount: { [key in TipoComida]: number } = {
        Desayuno: 0,
        Colacion1: 0,
        Comida: 0,
        Colacion2: 0,
        Cena: 0
    };

    const opcionesCountDetox = {
        Desayuno: 0,
        Colacion1: 0,
        Comida: 0,
        Colacion2: 0,
        Cena: 0
    };

    const opcionesCountMes1 = {
        Desayuno: 0,
        Colacion1: 0,
        Comida: 0,
        Colacion2: 0,
        Cena: 0
    };

    const opcionesCountMes2 = {
        Desayuno: 0,
        Colacion1: 0,
        Comida: 0,
        Colacion2: 0,
        Cena: 0
    };
    

    comidasAjustadasDetox.forEach(comida => {
        var tipoComidaAjustado = "";
        switch (comida.tipo) {
            case 'Colación 1':
                tipoComidaAjustado = "Colacion1";
                break;
            case 'Colación 2':
                tipoComidaAjustado = "Colacion2";
                break;
        
            default:
                tipoComidaAjustado = comida.tipo;
                break;
        } 
        const tipoComida = tipoComidaAjustado as TipoComida;

        if (opcionesCountDetox[tipoComida] < maxOpciones) {
            const opcionKey = `Opcion ${opcionesCountDetox[tipoComida] + 1}`;
            jsonResponse.Detox[tipoComida][opcionKey] = {
                nombre: comida.nombre,
                ingredientes: comida.ingredientes.map(ingrediente => ({
                    nombre: ingrediente.nombre,
                    //porcion: `${ingrediente.porcionAjustada} ${ingrediente.tipoPorcion} (${ingrediente.caloriasAjustadas!.toFixed(2)} Calorías)`
                    porcion: `${ingrediente.porcionAjustada} ${ingrediente.tipoPorcion}`
                }))
            };
            opcionesCountDetox[tipoComida]++;
        }
    });

    comidasAjustadasMes1.forEach(comida => {
        var tipoComidaAjustado = "";
        switch (comida.tipo) {
            case 'Colación 1':
                tipoComidaAjustado = "Colacion1";
                break;
            case 'Colación 2':
                tipoComidaAjustado = "Colacion2";
                break;
        
            default:
                tipoComidaAjustado = comida.tipo;
                break;
        } 
        const tipoComida = tipoComidaAjustado as TipoComida;

        if (opcionesCountMes1[tipoComida] < maxOpciones) {
            const opcionKey = `Opcion ${opcionesCountMes1[tipoComida] + 1}`;
            jsonResponse.Mes1[tipoComida][opcionKey] = {
                nombre: comida.nombre,
                ingredientes: comida.ingredientes.map(ingrediente => ({
                    nombre: ingrediente.nombre,
                    //porcion: `${ingrediente.porcionAjustada} ${ingrediente.tipoPorcion} (${ingrediente.caloriasAjustadas!.toFixed(2)} Calorías)`
                    porcion: `${ingrediente.porcionAjustada} ${ingrediente.tipoPorcion}`
                }))
            };
            opcionesCountMes1[tipoComida]++;
        }
    });

    comidasAjustadasMes2.forEach(comida => {
        var tipoComidaAjustado = "";
        switch (comida.tipo) {
            case 'Colación 1':
                tipoComidaAjustado = "Colacion1";
                break;
            case 'Colación 2':
                tipoComidaAjustado = "Colacion2";
                break;
        
            default:
                tipoComidaAjustado = comida.tipo;
                break;
        } 
        const tipoComida = tipoComidaAjustado as TipoComida;

        if (opcionesCountMes2[tipoComida] < maxOpciones) {
            const opcionKey = `Opcion ${opcionesCountMes2[tipoComida] + 1}`;
            jsonResponse.Mes2[tipoComida][opcionKey] = {
                nombre: comida.nombre,
                ingredientes: comida.ingredientes.map(ingrediente => ({
                    nombre: ingrediente.nombre,
                    //porcion: `${ingrediente.porcionAjustada} ${ingrediente.tipoPorcion} (${ingrediente.caloriasAjustadas!.toFixed(2)} Calorías)`
                    porcion: `${ingrediente.porcionAjustada} ${ingrediente.tipoPorcion}`
                }))
            };
            opcionesCountMes2[tipoComida]++;
        }
    });

    return jsonResponse;

    //return comidasAjustadas;
}

function getComidasSinRepeticion( planAlimenticio: MealPlan, alimentosEvitar: string[], paraDetox: boolean ){

    const desayunos = seleccionarComidasSinRepeticion(planAlimenticio.Desayunos, 5,alimentosEvitar,paraDetox);
    const colaciones_1 = seleccionarComidasSinRepeticion(planAlimenticio.Colaciones, 5,alimentosEvitar,paraDetox);
    const comidas = seleccionarComidasSinRepeticion(planAlimenticio.Comidas, 5,alimentosEvitar,paraDetox);
    const colaciones_2 = seleccionarComidasSinRepeticion(planAlimenticio.Colaciones, 5,alimentosEvitar,paraDetox);
    const cenas = seleccionarComidasSinRepeticion(planAlimenticio.Cenas, 5,alimentosEvitar,paraDetox);

    return [ desayunos, colaciones_1, comidas, colaciones_2, cenas ];

}

export const generateMealPlanNew = async(req: Request, res: Response) => {
    try {
        const { tipo_dieta, alimentos_evitar, objetivo, tmb } = req.body;

        if (!objetivo || !tmb || !tipo_dieta) {
            return res.status(400).json({ success: false, message: "Faltan parámetros requeridos: objetivo, tmb y/o tipo_dieta" });
        }

        // Validar el objetivo y obtener los porcentajes
       
        let distribucion = getPorcentajesDistribucionPorObjetivo(objetivo);
       

        // Obtener la lista de alimentos
        const alimentosRaw = await NuevoAlimento.findAll({
            order: [["nombre", "ASC"]],
        });
        
        const alimentos: Alimento[] = alimentosRaw.map((alimento) => alimento.toJSON()) as Alimento[];

        // Preparar la lista de alimentos en formato detallado
        const alimentosList = alimentos
            .map((alimento) =>{
                //console.log(alimento);
                const unidad = alimento.unidad_medida == "pz" ? "pieza" : alimento.unidad_medida;
                //console.log(unidad);
                //console.log(`- ${alimento.nombre}, equivalente ${alimento.equivalente} (${unidad}): ${alimento.kcal} kcal, ${alimento.proteinas}g proteínas, ${alimento.lipidos}g lípidos, ${alimento.hco}g carbohidratos. Grupo: ${alimento.grupo}.`);
                return `- ${alimento.nombre}, equivalente ${alimento.equivalente} (${unidad}): ${alimento.kcal} kcal, ${alimento.proteinas}g proteínas, ${alimento.lipidos}g lípidos, ${alimento.hco}g carbohidratos. Grupo: ${alimento.grupo}.`
            }).join("\n");

        
        // Secciones a generar
        const sections = ["Detox", "Mes1", "Mes2"];
        const completePlan: any = {};

        // Configurar OpenAI
        console.log(process.env.OPENAI_API_KEY);
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        for (const section of sections) {
            const prompt = `
Genera la sección "${section}" de un plan alimenticio para una persona que tiene las siguientes características:
- Objetivo: ${objetivo}
- Tasa metabólica basal: ${tmb} kcal
- Tipo de dieta: ${tipo_dieta}
- Alimentos a evitar: ${alimentos_evitar}

La distribución de macronutrientes debe ser la siguiente:
- Proteínas: ${(distribucion.proteina * 100).toFixed(0)}% del total
- Lípidos: ${(distribucion.lipidos * 100).toFixed(0)}% del total
- Carbohidratos: ${(distribucion.hco * 100).toFixed(0)}% del total

Cada tipo de comida debe contener 3 opciones además que, cada opción de comida debe incluir:
- Un **nombre** del platillo.
- Una lista de **ingredientes** con el siguiente detalle:
  - nombre: Nombre del ingrediente.
  - porcion: Cantidad específica de ese ingrediente en unidades, gramos, piezas, o tazas según corresponda.

Tomar en cuenta los siguientes alimentos:
${alimentosList}

En caso de que se considere necesario, agregar alimentos para generar comidas más variadas, ya que para los planes veganos no se cuenta con un número adecuado de alimentos que puedan funcionar para la generación de planes variados.
Considerar que las comidas no se deben repetir en las opciones y en el plan generado entre Detox, Mes1 y Mes2.

Responde solo en formato JSON con la estructura:
{
    "${section}": {
        "Desayuno": {
            "Opcion 1": { "nombre": "...", "ingredientes": [...] },
            "Opcion 2": { "nombre": "...", "ingredientes": [...] },
            "Opcion 3": { "nombre": "...", "ingredientes": [...] },
            ...
        },
        "Comida": { ... },
        "Cena": { ... },
        "Colación": { ... }
    }
}`;
            console.log("GENERANDO SECCIÓN: "+section);
            // Hacer la solicitud a la API de OpenAI
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 3000,
                temperature: 0.7,
            });

            const planSection = response.choices[0].message?.content;

            if (!planSection) {
                throw new Error(`No se recibió respuesta para la sección ${section}.`);
            }

            // Agregar la sección al plan completo
            completePlan[section] = JSON.parse(planSection)?.[section];

        }
               


        // Crear el prompt dinámico para ChatGPT
        //const alimentosList = alimentos.map((alimento) => `- ${alimento.nombre}`).join("\n");
        //console.log("LISTA DE ALIMENTOS");
        //console.log(alimentosList);


        console.log("EL PLAN GENERADO POR GPT");
        console.log(JSON.stringify(completePlan,null,2));
    

        // Devolver el plan generado
        res.status(200).json({
            status: "Ok",
            msg: "Plan generado",
            //data: JSON.parse(plan || "{}"),
            data: completePlan
        });

    } catch (error:any) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }

    
}

const calcularCaloriasPorObjetivo = (tmb: number, objetivo: string): number => {
    switch (objetivo) {
      case "Bajar de peso":
        return tmb * 0.8; // Reducir calorías en un 20%
      case "Mantenimiento":
        return tmb; // Mantener TMB
      case "Ganar masa muscular":
        return tmb * 1.2; // Incrementar calorías en un 20%
      default:
        throw new Error("Objetivo no válido");
    }
};

// Función para calcular la distribución calórica de macronutrientes
const calcularDistribucionCalorica = (calorias: number) => {

    const objDistribucion = {
        proteinas: calorias * 0.3 / 4, // 30% de las calorías en proteínas
        carbohidratos: calorias * 0.5 / 4, // 50% de las calorías en carbohidratos
        grasas: calorias * 0.2 / 9, // 20% de las calorías en grasas
      };

      console.log(JSON.stringify(objDistribucion,null,2));

    return objDistribucion;
};

// Función para calcular el cuadro dietosintético dinámico
const calcularCuadroDietosintetico = (alimentos: Alimento[], distribucionCalorica: any): CuadroDietosintetico => {
    const cuadro: CuadroDietosintetico = {};
  
    // Definir prioridades
    const gruposPrioritarios = ["Verduras", "Frutas", "AOA"] as const;
  
    // Configurar rangos de equivalentes para cada grupo
    const rangosEquivalentes: Record<typeof gruposPrioritarios[number], { min: number; max: number }> = {
      Verduras: { min: 3, max: 5 },
      Frutas: { min: 1, max: 2 },
      AOA: { min: 1, max: 4 }, // Ajustar según necesidades de proteínas
    };
  
    // Recorrer cada grupo prioritario
    gruposPrioritarios.forEach((grupo) => {
      const alimentosGrupo = alimentos.filter((alimento) => alimento.grupo.startsWith(grupo));
      let requeridos = rangosEquivalentes[grupo].min; // Ahora TypeScript sabe que "grupo" es válido
  
      // Asignar equivalentes dentro del rango permitido
      while (requeridos > 0 && alimentosGrupo.length > 0) {
        const alimento = alimentosGrupo.shift(); // Tomar el primer alimento del grupo
        if (!alimento) break;
  
        const cantidadEquivalentes = Math.min(
          requeridos,
          Math.floor(distribucionCalorica.proteinas / alimento.proteinas) || 0
        );
  
        cuadro[grupo] = (cuadro[grupo] || 0) + cantidadEquivalentes;
        distribucionCalorica.proteinas -= cantidadEquivalentes * alimento.proteinas;
  
        requeridos -= cantidadEquivalentes;
      }
    });

    console.log("cuadro")
    console.log(JSON.stringify(cuadro,null,2))
  
    // Retornar solo los grupos prioritarios con sus equivalentes asignados
    return cuadro;
};
  
  
  
// Validar alimentos según tipo de dieta y restricciones
const validarAlimento = (alimento: Alimento, tipo_dieta: string, alimentos_evitar: string[]): boolean => {
    if (alimentos_evitar.includes(alimento.nombre.trim())) return false;
    if (tipo_dieta === "Vegetariana" && alimento.grupo.startsWith("AOA")) return false;
    return true;
};
  
// Generar el plan alimenticio distribuyendo alimentos en tiempos de comida
const generarPlan = (alimentos: Alimento[], cuadroDietosintetico: CuadroDietosintetico): PlanAlimenticio => {
    const plan: PlanAlimenticio = {
      desayuno: generarOpcionesTiempo(alimentos, ["desayuno", "Todas"], cuadroDietosintetico),
      comida: generarOpcionesTiempo(alimentos, ["comida", "Todas"], cuadroDietosintetico),
      cena: generarOpcionesTiempo(alimentos, ["cena", "Todas"], cuadroDietosintetico),
      colacion: generarOpcionesTiempo(alimentos, ["colacion", "Todas"], cuadroDietosintetico),
    };
  
    return plan;
};
  

// Generar 3 opciones para un tiempo de comida
const generarOpcionesTiempo = (
    alimentos: Alimento[],
    tiempos: string[],
    cuadroDietosintetico: CuadroDietosintetico
  ): OpcionTiempoComida => {
    const alimentosFiltrados = alimentos.filter((alimento) =>
      tiempos.some((tiempo) => alimento.tiempo_comida.includes(tiempo))
    );
  
    const opciones: string[][] = [];
  
    for (let i = 0; i < 3; i++) {
      const opcion: string[] = [];
      const alimentosUsados = new Set<string>();
  
      // Definir grupos y límites realistas
      const gruposRequeridos: Record<string, number> = {
        Verduras: 3,
        Frutas: tiempos.includes("desayuno") || i === 0 ? 1 : 0,
        Cereales: tiempos.includes("desayuno") || tiempos.includes("comida") ? 1 : 0,
        Leguminosas: tiempos.includes("comida") ? 1 : 0,
        AOA: 1, // Una proteína principal
      };
  
      Object.keys(gruposRequeridos).forEach((grupo) => {
        // Filtrar alimentos por grupo
        const grupoAlimentos = alimentosFiltrados.filter((alimento) =>
          grupo === "AOA"
            ? alimento.grupo.startsWith("AOA")
            : alimento.grupo === grupo && !alimentosUsados.has(alimento.nombre)
        );
  
        let requeridos = gruposRequeridos[grupo];
  
        if (grupo === "AOA" && grupoAlimentos.length > 0) {
          // Para proteínas (AOA), preferir más de 1 equivalente
          const index = Math.floor(Math.random() * grupoAlimentos.length);
          const alimento = grupoAlimentos[index];
          const minEquivalentes = 3; // Configuración para garantizar más de 1 equivalente
          const cantidadProteina = minEquivalentes * alimento.equivalente;
  
          opcion.push(`${alimento.nombre} - ${cantidadProteina} ${alimento.unidad_medida}`);
          alimentosUsados.add(alimento.nombre);
          requeridos = 0; // Satisfacer la cantidad requerida de AOA
        } else {
          // Para otros grupos, asignar valores estándar
          while (requeridos > 0 && grupoAlimentos.length > 0) {
            const index = Math.floor(Math.random() * grupoAlimentos.length);
            const alimento = grupoAlimentos[index];
  
            const cantidad = Math.min(requeridos, 1); // Para otros grupos, asignar 1 unidad
            opcion.push(`${alimento.nombre} - ${cantidad} ${alimento.unidad_medida}`);
            alimentosUsados.add(alimento.nombre);
  
            requeridos -= cantidad;
            grupoAlimentos.splice(index, 1); // Remover alimento seleccionado
          }
        }
      });
  
      opciones.push(opcion);
    }
  
    return {
      opcion1: opciones[0] || [],
      opcion2: opciones[1] || [],
      opcion3: opciones[2] || [],
    };
};  

const calculateMacros = (tmb: number, objetivo: string): { calorias: number; proteinas: number; lipidos: number; carbohidratos: number } => {
    let factorCalorias: number;
  
    switch (objetivo) {
      case "Bajar de peso":
        factorCalorias = 0.8; // 80% de TMB
        break;
      case "Mantenimiento":
        factorCalorias = 1.0; // 100% de TMB
        break;
      case "Ganar masa muscular":
        factorCalorias = 1.2; // 120% de TMB
        break;
      default:
        throw new Error("Objetivo no válido");
    }
  
    const calorias = tmb * factorCalorias;
  
    // Proporciones: 40% proteínas, 30% lípidos, 30% carbohidratos
    return {
      calorias,
      proteinas: (calorias * 0.4) / 4, // gramos de proteínas
      lipidos: (calorias * 0.3) / 9,  // gramos de lípidos
      carbohidratos: (calorias * 0.3) / 4, // gramos de carbohidratos
    };
};

const filterAlimentosByGrupoAndTiempoComida = (alimentos: Alimento[], grupo: string, tiempoComida: string): Alimento[] => {
    return alimentos.filter(alimento => alimento.grupo === grupo && alimento.tiempo_comida.includes(tiempoComida));
};
  


function getPorcentajesDistribucionPorObjetivo( objetivo: string ){

    switch (objetivo) {
        case 'Bajar de peso':
            return { proteina: 0.3, lipidos: 0.3, hco: 0.4 };
        
        case 'Mantenimiento':
            return { proteina: 0.25, lipidos: 0.25, hco: 0.5 };
            
        case 'Ganar masa muscular':
            return { proteina: 0.35, lipidos: 0.2, hco: 0.45 };
 
        default:
            throw new Error('Objetivo no válido');
    }

}

// Función para calcular los gramos de macronutrientes según las calorías diarias
function calcularMacronutrientes(calorias: number, distribucion: { proteina: number; lipidos: number; hco: number }) {
    const proteinaGramos = (calorias * distribucion.proteina) / 4; // 4 kcal por gramo de proteína
    const lipidosGramos = (calorias * distribucion.lipidos) / 9; // 9 kcal por gramo de lípidos
    const hcoGramos = (calorias * distribucion.hco) / 4; // 4 kcal por gramo de carbohidratos
    return { proteina: proteinaGramos, lipidos: lipidosGramos, hco: hcoGramos };
  }

  /*
async function generarPlan( tmb:number, objetivo:string): Promise<void> {
    const caloriasDiarias = ajustarCaloriasPorObjetivo(tmb,objetivo);
    const distribucion = getPorcentajesDistribucionPorObjetivo( objetivo );
    const macronutrientesTotales = calcularMacronutrientes(caloriasDiarias, distribucion);

    console.log('Calorías Diarias:', caloriasDiarias);
    console.log('Macronutrientes Totales:', macronutrientesTotales);

    let macronutrientesRestantes = { ...macronutrientesTotales };

    const plan: Record<string, Alimento[][]> = {};
    for (const [comida, grupos] of Object.entries(distribucionPorComida)) {
        plan[comida] = await generarOpcionesParaComida(comida, grupos, macronutrientesRestantes);
    }

    // Mostrar el plan alimenticio
    console.log('\nPlan Alimenticio:');
    for (const [comida, opciones] of Object.entries(plan)) {
        console.log(`\n${comida}:`);
        opciones.forEach((opcion, index) => {
        console.log(`Opción ${index + 1}:`);
        opcion.forEach((alimento) =>
            console.log(
            `- ${alimento.nombre} (${alimento.equivalente} ${alimento.unidad_medida}): ${alimento.kcal} kcal`
            )
        );
        });
    }
}
    */

  async function generarOpcionesParaComida(
    comida: TiempoComida,
    grupos: string[],
    macronutrientesRestantes: { proteina: number; lipidos: number; hco: number }
  ): Promise<Alimento[][]> {
    const opciones: Alimento[][] = [];
    const maxAlimentosPorOpcion = 4; // Máximo de alimentos por opción
    const tiemposPermitidos: Record<TiempoComida, string> = {
      desayuno: "desayuno",
      colacion: "colacion",
      comida: "comida",
      cena: "cena",
    };
  
    // Grupos restringidos (AOA)
    const gruposRestringidos = [
      "AOA muy bajo en grasa",
      "AOA bajo en grasa",
      "AOA moderado en grasa",
    ];
  
    // Filtrar alimentos por el tiempo_comida correspondiente
    const alimentosDisponibles = await NuevoAlimento.findAll({
      where: {
        tiempo_comida: { [Op.like]: `%${tiemposPermitidos[comida]}%` },
      },
      order: [["nombre", "ASC"]],
    });
  
    const alimentosConvertidos: Alimento[] = alimentosDisponibles.map((alimento: any) => ({
      id: alimento.id,
      nombre: alimento.nombre,
      grupo: alimento.grupo,
      equivalente: alimento.equivalente,
      unidad_medida: alimento.unidad_medida,
      proteinas: parseFloat(alimento.proteinas),
      lipidos: parseFloat(alimento.lipidos),
      hco: parseFloat(alimento.hco),
      kcal: parseFloat(alimento.kcal),
      tiempo_comida: alimento.tiempo_comida,
      categoria: alimento.categoria,
    }));
  
    // Generar las opciones
    for (let i = 0; i < 3; i++) { // Tres opciones por comida
      const opcion: Alimento[] = [];
      const gruposSeleccionados = [...grupos];
      const gruposUsados: Set<string> = new Set(); // Para rastrear los grupos restringidos en cada opción
      let intentos = 0;
  
      while (
        opcion.length < maxAlimentosPorOpcion &&
        (macronutrientesRestantes.proteina > 0 ||
          macronutrientesRestantes.lipidos > 0 ||
          macronutrientesRestantes.hco > 0) &&
        intentos < 100
      ) {
        intentos++;
        if (gruposSeleccionados.length === 0) break;
  
        const grupoAleatorio =
          gruposSeleccionados[Math.floor(Math.random() * gruposSeleccionados.length)];
        const alimentosPorGrupo = alimentosConvertidos.filter(
          (alimento) => alimento.grupo === grupoAleatorio
        );
  
        if (alimentosPorGrupo.length > 0) {
          const alimentoAleatorio =
            alimentosPorGrupo[Math.floor(Math.random() * alimentosPorGrupo.length)];
  
          // Restricción: verificar que el grupo no esté repetido si pertenece a los restringidos
          if (
            gruposRestringidos.includes(alimentoAleatorio.grupo) &&
            gruposUsados.has(alimentoAleatorio.grupo)
          ) {
            continue; // Saltar este alimento si ya hay uno del mismo grupo
          }
  
          // Validar si los macronutrientes son suficientes
          if (
            alimentoAleatorio.proteinas <= macronutrientesRestantes.proteina &&
            alimentoAleatorio.lipidos <= macronutrientesRestantes.lipidos &&
            alimentoAleatorio.hco <= macronutrientesRestantes.hco
          ) {
            opcion.push(alimentoAleatorio);
  
            // Registrar el grupo si es restringido
            if (gruposRestringidos.includes(alimentoAleatorio.grupo)) {
              gruposUsados.add(alimentoAleatorio.grupo);
            }
  
            // Descontar macronutrientes
            macronutrientesRestantes.proteina -= alimentoAleatorio.proteinas;
            macronutrientesRestantes.lipidos -= alimentoAleatorio.lipidos;
            macronutrientesRestantes.hco -= alimentoAleatorio.hco;
          }
        }
  
        const index = gruposSeleccionados.indexOf(grupoAleatorio);
        if (index !== -1) gruposSeleccionados.splice(index, 1);
      }
  
      // Si la opción está incompleta, rellenarla con alimentos aleatorios sin romper restricciones
      while (opcion.length < maxAlimentosPorOpcion) {
        const alimentoAleatorio =
          alimentosConvertidos[Math.floor(Math.random() * alimentosConvertidos.length)];
  
        if (
          !opcion.includes(alimentoAleatorio) &&
          (!gruposRestringidos.includes(alimentoAleatorio.grupo) || 
           !gruposUsados.has(alimentoAleatorio.grupo))
        ) {
          opcion.push(alimentoAleatorio);
          if (gruposRestringidos.includes(alimentoAleatorio.grupo)) {
            gruposUsados.add(alimentoAleatorio.grupo);
          }
        }
      }
  
      opciones.push(opcion);
    }
  
    return opciones;
  }
  
  
  
