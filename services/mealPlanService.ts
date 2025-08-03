import OpenAI from 'openai';
import { NUTRITION_RULES, MACRONUTRIENT_RULES } from '../config/nutritionRules';
import { mealDataService } from './mealDataService';
import { validationService } from './validationService';
import { extractJsonFromMarkdown, extractMealNames } from '../utils/mealPlanUtils';

export interface MealPlanParams {
    tipo_dieta: string;
    objetivo: string;
    tmb: number;
    alimentos_evitar: string[];
    alimentos_preferencia: string[];
}

class MealPlanService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY!,
        });
    }

    async generateSection(
        section: string, 
        params: MealPlanParams, 
        exactMealNames: any,
        usedMeals: string[]
    ): Promise<string> {
        const macroRules = MACRONUTRIENT_RULES[params.objetivo] || MACRONUTRIENT_RULES['Mantenimiento'];
        const targetCalories = params.tmb + macroRules.caloriasAjuste;

        // 🔍 LOGGING CRÍTICO PARA DEBUG
        console.log(`🔍 DEBUG ${section} - exactMealNames recibido:`, JSON.stringify(exactMealNames, null, 2));
        console.log(`🔍 DEBUG ${section} - Comidas para "Comida":`, exactMealNames.Comida);
        console.log(`🔍 DEBUG ${section} - Cantidad de comidas por tiempo:`, {
            Desayuno: exactMealNames.Desayuno?.length || 0,
            Comida: exactMealNames.Comida?.length || 0,
            Colación: exactMealNames.Colación?.length || 0,
            Cena: exactMealNames.Cena?.length || 0
        });
        console.log(`🔍 DEBUG ${section} - usedMeals:`, usedMeals);

        // OPTIMIZACIÓN: Enviar solo las comidas del tiempo específico cuando sea posible
        const optimizedMealNames = {
            Desayuno: exactMealNames.Desayuno?.slice(0, 10) || [], // Limitar a 10 por tiempo
            Comida: exactMealNames.Comida?.slice(0, 10) || [],
            Colación: exactMealNames.Colación?.slice(0, 10) || [],
            Cena: exactMealNames.Cena?.slice(0, 10) || []
        };

        const response = await this.openai.chat.completions.create({
            model: "gpt-4-turbo",
            temperature: 0.1,
            messages: [
                {
                    role: "system",
                    content: `Eres un nutriólogo experto. DEBES usar ÚNICAMENTE y EXACTAMENTE estos nombres de comidas:

        NOMBRES EXACTOS PERMITIDOS:
        ${JSON.stringify(optimizedMealNames, null, 2)}

        REGLAS INQUEBRANTABLES:
        1. USA ÚNICAMENTE los nombres EXACTOS de la lista anterior - SIN MODIFICACIONES
        2. NO cambies ni una palabra de los nombres
        3. NO inventes comidas nuevas
        4. NUNCA repitas estos nombres ya usados: ${usedMeals.join(', ')}
        5. Si no hay suficientes opciones en un tiempo, usa las disponibles

        FORMATO DE RESPUESTA CRÍTICO:
        - Responde ÚNICAMENTE con JSON válido
        - NO uses bloques de código markdown (tres backticks seguidos de json, tres backticks solos, tres backticks con markdown)
        - NO agregues texto explicativo antes o después del JSON
        - El JSON debe comenzar con { y terminar con }

        PARA CADA NOMBRE EXACTO que elijas:
        - Genera los ingredientes específicos y sus porciones
        - Calcula porciones para ${params.objetivo} (TMB: ${params.tmb}, Calorías: ${targetCalories})
        - Escribe instrucciones de preparación detalladas

        DISTRIBUCIÓN NUTRICIONAL:
        - Proteínas: ${macroRules.proteinas}%
        - Grasas: ${macroRules.grasas}%
        - Carbohidratos: ${macroRules.carbohidratos}%
        - Proteína por comida principal: ${macroRules.protein_per_meal_min}-${macroRules.protein_per_meal_max}g

        ${NUTRITION_RULES}

        EVITAR: ${params.alimentos_evitar?.join(', ') || 'ninguno'}
        PREFERIR: ${params.alimentos_preferencia?.join(', ') || 'ninguna'}

        FORMATO JSON EXACTO - NO AGREGUES NADA MÁS:
        {
            "${section}": {
                "Desayuno": {
                    "Opcion 1": {"nombre": "NOMBRE EXACTO DE LA LISTA", "ingredientes": [{"nombre": "ingrediente", "porcion": "cantidad unidad"}], "preparacion": "pasos detallados"},
                    "Opcion 2": {"nombre": "NOMBRE EXACTO DE LA LISTA", "ingredientes": [...], "preparacion": "..."},
                    "Opcion 3": {"nombre": "NOMBRE EXACTO DE LA LISTA", "ingredientes": [...], "preparacion": "..."}
                },
                "Comida": { "Opcion 1": {...}, "Opcion 2": {...}, "Opcion 3": {...} },
                "Colación": { "Opcion 1": {...}, "Opcion 2": {...}, "Opcion 3": {...} },
                "Cena": { "Opcion 1": {...}, "Opcion 2": {...}, "Opcion 3": {...} },
            }
        }

        CRÍTICO: Verifica que cada "nombre" sea EXACTAMENTE igual a uno de la lista de nombres permitidos.`
                },
            {
                role: "user",
                content: `Genera ${section} usando ÚNICAMENTE los nombres exactos de la lista. Desarrolla ingredientes y porciones para ${params.objetivo} con TMB ${params.tmb}.`
            }
                ]
            });

        return response.choices[0]?.message?.content || '';
    }

    async generateCompletePlan(params: MealPlanParams): Promise<any> {
        const sections = ["Detox", "Mes1", "Mes2"];
        const completePlan: any = {};
        const usedMeals: string[] = [];

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            
            // 🔄 DELAY PRINCIPAL entre secciones para evitar rate limit
            if (i > 0) {
                console.log(`⏱️ Esperando 8 segundos antes de generar ${section}...`);
                await new Promise(resolve => setTimeout(resolve, 8000)); // 8 segundos entre secciones
            }

            let sectionPlan = null;
            let attempts = 0;
            const maxAttempts = 3;

            console.log(`🚀 Generando sección: ${section}`);

            while (!sectionPlan && attempts < maxAttempts) {
                attempts++;
                console.log(`🔄 Intento ${attempts} para ${section}`);

                try {
                    // DELAY ADICIONAL entre intentos (backoff exponencial)
                    if (attempts > 1) {
                        const waitTime = attempts * 5000; // 5s, 10s, 15s
                        console.log(`⏱️ Esperando ${waitTime/1000} segundos antes del intento ${attempts}...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }

                    // Obtener nombres exactos disponibles (excluyendo usados)
                    const exactMealNames = await mealDataService.getAvailableExactNames(
                        params.tipo_dieta, 
                        params.objetivo, 
                        usedMeals
                    );

                    console.log(`📋 Comidas disponibles para ${section}:`, {
                        Desayuno: exactMealNames.Desayuno?.length || 0,
                        Comida: exactMealNames.Comida?.length || 0,
                        Colación: exactMealNames.Colación?.length || 0,
                        Cena: exactMealNames.Cena?.length || 0
                    });

                    // FASE 1: Generación CON MANEJO DE RATE LIMIT
                    const generatedContent = await this.generateSectionWithRateLimit(section, params, exactMealNames, usedMeals);
                    
                    if (!generatedContent) {
                        console.log(`❌ No se recibió contenido para ${section}`);
                        continue;
                    }

                    // Detectar markdown temprano
                    if (generatedContent.includes('```') || generatedContent.includes('json')) {
                        console.log(`⚠️ Detectado markdown en respuesta de ${section}, reintentando...`);
                        continue;
                    }

                    console.log(`📝 Contenido generado para ${section} (primeros 200 chars):`, generatedContent.substring(0, 200) + '...');

                    // ... resto del código de validación igual ...
                    const cleanJson = extractJsonFromMarkdown(generatedContent);
                    
                    if (!cleanJson.startsWith('{') || !cleanJson.endsWith('}')) {
                        console.log(`❌ Contenido no es JSON válido para ${section}. Contenido limpio:`, cleanJson.substring(0, 100) + '...');
                        continue;
                    }
                    
                    let parsedPlan;
                    try {
                        parsedPlan = JSON.parse(cleanJson);
                        console.log(`✅ JSON parseado correctamente para ${section}`);
                    } catch (parseError:any) {
                        console.log(`❌ Error parseando JSON para ${section}:`, parseError.message);
                        console.log(`Contenido problemático (primeros 300 chars):`, cleanJson.substring(0, 300) + '...');
                        continue;
                    }
                    
                    const sectionData = parsedPlan[section] || parsedPlan;
                    
                    if (!sectionData || typeof sectionData !== 'object') {
                        console.log(`❌ Estructura incorrecta para ${section}:`, typeof sectionData);
                        continue;
                    }

                    // 🔍 VALIDACIÓN ESTRICTA DE NOMBRES
                    let hasInvalidNames = false;
                    for (const [timeOfDay, options] of Object.entries(sectionData)) {
                        if (timeOfDay === 'Hidratación') continue;
                        
                        if (!options || typeof options !== 'object') continue;
                        
                        for (const [optionKey, meal] of Object.entries(options as any)) {
                            const mealObj = meal as any;
                            if (!mealObj || !mealObj.nombre) continue;
                            
                            const mealName = mealObj.nombre;
                            const availableNames = exactMealNames[timeOfDay] || [];
                            
                            if (!availableNames.includes(mealName)) {
                                console.log(`❌ NOMBRE INVÁLIDO detectado: "${mealName}" en ${timeOfDay} - ${optionKey}`);
                                console.log(`✅ Nombres válidos para ${timeOfDay}:`, availableNames.join(', '));
                                hasInvalidNames = true;
                                break;
                            }
                        }
                        
                        if (hasInvalidNames) break;
                    }

                    if (hasInvalidNames) {
                        console.log(`❌ Se encontraron nombres inválidos en ${section}, reintentando...`);
                        continue;
                    }

                    console.log(`✅ Todos los nombres son válidos para ${section}`);

                    // Verificar tiempos de comida necesarios
                    const requiredMealTimes = ['Desayuno', 'Comida', 'Colación', 'Cena', 'Hidratación'];
                    const missingMealTimes = requiredMealTimes.filter(time => {
                        if (time === 'Hidratación') {
                            return !sectionData[time] || !sectionData[time].recomendaciones;
                        }
                        return !sectionData[time] || Object.keys(sectionData[time]).length < 3;
                    });

                    if (missingMealTimes.length > 0) {
                        console.log(`❌ Faltan tiempos de comida en ${section}:`, missingMealTimes);
                        continue;
                    }

                    // FASE 2: Validación
                    console.log(`🔍 Validando ${section}...`);
                    const validation = await validationService.validatePlanSection(
                        sectionData, 
                        section, 
                        exactMealNames, 
                        usedMeals
                    );

                    if (validation.esValido) {
                        sectionPlan = sectionData;
                        const newMeals = extractMealNames(sectionData);
                        usedMeals.push(...newMeals);
                        console.log(`✅ ${section} generado y validado correctamente`);
                        console.log(`📝 Nuevas comidas agregadas (${newMeals.length}):`, newMeals.join(', '));
                        
                        if (validation.advertencias && validation.advertencias.length > 0) {
                            console.log(`⚠️ Advertencias para ${section}:`, validation.advertencias);
                        }
                    } else {
                        // FASE 3: Corrección con delay adicional
                        console.log(`❌ Errores en validación de ${section}:`, validation.errores);
                        
                        if (attempts < maxAttempts) {
                            console.log(`🔧 Intentando corrección automática para ${section}...`);
                            console.log(`⏱️ Esperando 3 segundos antes de la corrección...`);
                            await new Promise(resolve => setTimeout(resolve, 3000)); // Delay antes de corrección
                            
                            try {
                                const correctedContent = await this.correctSectionWithRateLimit(
                                    sectionData,
                                    validation.errores,
                                    exactMealNames,
                                    usedMeals
                                );

                                // ... resto de la lógica de corrección igual ...
                            } catch (correctionError:any) {
                                console.error(`❌ Error en proceso de corrección para ${section}:`, correctionError.message);
                            }
                        }
                    }
                } catch (error: any) {
                    if (error.message?.includes('rate_limit_exceeded')) {
                        console.log(`⏱️ Rate limit detectado en ${section}, esperando 10 segundos...`);
                        await new Promise(resolve => setTimeout(resolve, 10000));
                        continue; // Reintentar sin incrementar attempts
                    }
                    
                    console.error(`❌ Error en intento ${attempts} para ${section}:`, error.message);
                }
            }

            if (!sectionPlan) {
                throw new Error(`No se pudo generar una sección válida para ${section} después de ${maxAttempts} intentos.`);
            }

            completePlan[section] = sectionPlan;
            console.log(`🎯 Sección ${section} completada exitosamente`);
        }

        // ... resto igual (estadísticas finales)
        const totalMealsUsed = usedMeals.length;
        const uniqueMealsUsed = [...new Set(usedMeals)].length;
        
        console.log(`🎉 Plan completo generado exitosamente`);
        console.log(`📊 Estadísticas finales:`);
        console.log(`   - Secciones generadas: ${sections.length}`);
        console.log(`   - Total de comidas utilizadas: ${totalMealsUsed}`);
        console.log(`   - Comidas únicas utilizadas: ${uniqueMealsUsed}`);

        return {
            plan: completePlan,
            statistics: {
                totalMealsGenerated: totalMealsUsed,
                uniqueMealsGenerated: uniqueMealsUsed,
                sectionsGenerated: sections.length,
                usedMeals: usedMeals,
                mealsBySection: sections.map(section => ({
                    section,
                    meals: extractMealNames(completePlan[section])
                }))
            }
        };
    }

    // Función para generar sección con manejo de rate limit
    async generateSectionWithRateLimit(
        section: string, 
        params: MealPlanParams, 
        exactMealNames: any,
        usedMeals: string[]
    ): Promise<string> {
        try {
            return await this.generateSection(section, params, exactMealNames, usedMeals);
        } catch (error: any) {
            if (error.message?.includes('rate_limit_exceeded')) {
                console.log(`⏱️ Rate limit en generateSection, esperando 15 segundos...`);
                await new Promise(resolve => setTimeout(resolve, 15000));
                return await this.generateSection(section, params, exactMealNames, usedMeals);
            }
            throw error;
        }
    }

    // Función para corrección con manejo de rate limit
    async correctSectionWithRateLimit(
        sectionData: any,
        errors: string[],
        exactMealNames: any,
        usedMeals: string[]
    ): Promise<string> {
        try {
            return await validationService.correctPlanSection(sectionData, errors, exactMealNames, usedMeals);
        } catch (error: any) {
            if (error.message?.includes('rate_limit_exceeded')) {
                console.log(`⏱️ Rate limit en corrección, esperando 15 segundos...`);
                await new Promise(resolve => setTimeout(resolve, 15000));
                return await validationService.correctPlanSection(sectionData, errors, exactMealNames, usedMeals);
            }
            throw error;
        }
    }

}

export const mealPlanService = new MealPlanService();