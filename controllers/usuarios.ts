import { Request, Response } from "express";
import Usuario from '../models/usuario';
import { QueryTypes, Sequelize, json } from "sequelize";
import db from "../db/connection";
import { Ingredient, JSONResponse, Meal, MealGroup, MealPlan, TipoComida } from "./interfaces";

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
        console.log(alimentos_evitar);

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
            if (mealType) {
                mealPlan[mealTypes[mealType]].push(meal);
            }
        }
    }

    return mealPlan;

}

function ajustarCaloriasPorObjetivo(tmb: number, objetivo: string): number {
    switch (objetivo) {
        case 'Bajar de peso':
            return tmb * 0.8; // Reducir en 20%
        case 'Mantenimiento':
            return tmb; // Mismo que la TMB
        case 'Ganar masa muscular':
            return tmb * 1.2; // Incrementar en 20%
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
            case 'g':
                porcionAjustadaRedondeada = Math.round(porcionAjustada / 5) * 5;
                break;
            case 'ml':
                porcionAjustadaRedondeada = Math.round(porcionAjustada / 10) * 10;
                break;
            case 'taza':
                porcionAjustadaRedondeada = Math.round(porcionAjustada * 10) / 10;
                break;
            default:
                porcionAjustadaRedondeada = porcionAjustada; // No redondear si el tipo no está en la lista
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

function seleccionarComidasSinRepeticion(comidas: MealGroup[], cantidad: number, alimentosAEvitar: string[]): MealGroup[] {

    const comidasFiltradas = alimentosAEvitar.length > 0
        ? comidas.filter(comida =>
            !comida.ingredientes.some(ingrediente => alimentosAEvitar.includes(ingrediente.nombre))
        )
        : comidas;

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
     // Porcentajes de calorías por cada tipo de comida (Aportación calórica por cada tipo de comida)
    const porcentajesCaloricos = {
        desayuno: 0.225,
        colacion1: 0.10,
        comida: 0.35,
        colacion2: 0.10,
        cena: 0.225
    };

    // Calorías objetivo por cada tipo de comida
    const caloriasDesayuno = caloriasDiarias * porcentajesCaloricos.desayuno;
    const caloriasColacion1 = caloriasDiarias * porcentajesCaloricos.colacion1;
    const caloriasComida = caloriasDiarias * porcentajesCaloricos.comida;
    const caloriasColacion2 = caloriasDiarias * porcentajesCaloricos.colacion2;
    const caloriasCena = caloriasDiarias * porcentajesCaloricos.cena;

    const desayunos = seleccionarComidasSinRepeticion(planAlimenticio.Desayunos, 5,alimentosEvitar);
    const colaciones_1 = seleccionarComidasSinRepeticion(planAlimenticio.Colaciones, 5,alimentosEvitar);
    const comidas = seleccionarComidasSinRepeticion(planAlimenticio.Comidas, 5,alimentosEvitar);
    const colaciones_2 = seleccionarComidasSinRepeticion(planAlimenticio.Colaciones, 5,alimentosEvitar);
    const cenas = seleccionarComidasSinRepeticion(planAlimenticio.Cenas, 5,alimentosEvitar);

    const comidasSeleccionadas = [
        { comidas: desayunos, caloriasObjetivo: caloriasDesayuno, tipo: "Desayuno" },
        { comidas: colaciones_1, caloriasObjetivo: caloriasColacion1, tipo: "Colación 1"},
        { comidas: comidas, caloriasObjetivo: caloriasComida, tipo: "Comida"},
        { comidas: colaciones_2, caloriasObjetivo: caloriasColacion2, tipo: "Colación 2"},
        { comidas: cenas, caloriasObjetivo: caloriasCena, tipo: "Cena"}
    ];

    const comidasAjustadas = comidasSeleccionadas.map(({ comidas, caloriasObjetivo, tipo }) => {
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

     comidasAjustadas.forEach(comida => {
            console.log(`${comida.tipo}`);
            console.log(`Comida: ${comida.nombre}`);
            console.log(`Calorías Totales Ajustadas: ${comida.caloriasTotalesAjustadas}`);
            comida.ingredientes.forEach(ingrediente => {
                console.log(`- ${ingrediente.nombre}: ${ingrediente.porcionAjustada} ${ingrediente.tipoPorcion} (${ingrediente.caloriasAjustadas?.toFixed(2)} Calorías)`);
            });
            console.log();
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

    comidasAjustadas.forEach(comida => {
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
        if (opcionesCount[tipoComida] < maxOpciones) {
            const opcionKey = `Opcion ${opcionesCount[tipoComida] + 1}`;
            jsonResponse.Detox[tipoComida][opcionKey] = {
                nombre: comida.nombre,
                ingredientes: comida.ingredientes.map(ingrediente => ({
                    nombre: ingrediente.nombre,
                    //porcion: `${ingrediente.porcionAjustada} ${ingrediente.tipoPorcion} (${ingrediente.caloriasAjustadas!.toFixed(2)} Calorías)`
                    porcion: `${ingrediente.porcionAjustada} ${ingrediente.tipoPorcion}`
                }))
            };
            opcionesCount[tipoComida]++;
        }
    });


    return jsonResponse;

    //return comidasAjustadas;
}