import OpenAI from 'openai';
import { NUTRITION_RULES, MACRONUTRIENT_RULES, DIET_TYPE_RULES, validateMealAgainstRules } from '../config/nutritionRules';
import ComidaDisponible from '../models/comida_disponible';
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

    // Función para obtener comidas disponibles desde Sequelize
    private async getAvailableExactNames(
        dietType: string, 
        objetivo: string, 
        excludeMeals: string[] = [], 
        allowReuse: boolean = false
    ): Promise<any> {
        try {
            console.log(`Buscando comidas para dieta: ${dietType}, objetivo: ${objetivo}`);
            console.log(`Excluyendo: ${excludeMeals.join(', ')}`);
            console.log(`Reutilización permitida: ${allowReuse}`);

            // Construir condiciones WHERE
            const whereConditions: any = {
                tipo_dieta: dietType,
                objetivo: objetivo,
                activo: 1
            };

            // Si no se permite reutilización, excluir las comidas ya usadas
            if (!allowReuse && excludeMeals.length > 0) {
                whereConditions.nombre_exacto = {
                    [require('sequelize').Op.notIn]: excludeMeals
                };
            }

            const results = await ComidaDisponible.findAll({
                where: whereConditions,
                order: [['tiempo_comida', 'ASC'], ['nombre_exacto', 'ASC']]
            });

            if (!results || results.length === 0) {
                console.log(`No se encontraron comidas para dieta: ${dietType}, objetivo: ${objetivo}`);
                return this.getEmptyMealStructure();
            }

            console.log(`Total de comidas encontradas: ${results.length}`);

            // Agrupar por tiempo de comida
            const mealsByTime: any = {
                'Desayuno': [],
                'Comida': [],
                'Colación': [],
                'Cena': []
            };

            for (const meal of results) {
                const mealData = meal.toJSON();
                const timeOfDay = mealData.tiempo_comida;
                const mealName = mealData.nombre_exacto;

                if (mealsByTime[timeOfDay]) {
                    mealsByTime[timeOfDay].push(mealName);
                }
            }

            // Log de estadísticas por tiempo
            for (const [time, meals] of Object.entries(mealsByTime)) {
                console.log(`${time}: ${(meals as string[]).length} comidas disponibles`);
            }

            // Verificar si algún tiempo tiene muy pocas opciones
            const minMealsNeeded = 3;
            let needsReuse = false;

            for (const [time, meals] of Object.entries(mealsByTime)) {
                if ((meals as string[]).length < minMealsNeeded) {
                    console.log(`${time} tiene solo ${(meals as string[]).length} comidas, menos del mínimo requerido (${minMealsNeeded})`);
                    needsReuse = true;
                }
            }

            // Si algún tiempo necesita más opciones y no se permite reutilización, volver a consultar
            if (needsReuse && !allowReuse) {
                console.log(`Reconsultando con reutilización permitida debido a pocas opciones...`);
                return this.getAvailableExactNames(dietType, objetivo, [], true);
            }

            // Si después de permitir reutilización aún hay tiempos vacíos, rellenar con básicos
            for (const [time, meals] of Object.entries(mealsByTime)) {
                if ((meals as string[]).length === 0) {
                    console.log(`${time} sigue vacío, agregando comidas básicas...`);
                    mealsByTime[time] = this.getBasicMealsForTime(time);
                }
            }

            return mealsByTime;

        } catch (error) {
            console.error('Error en getAvailableExactNames:', error);
            return this.getEmptyMealStructure();
        }
    }

    private getEmptyMealStructure(): any {
        return {
            'Desayuno': this.getBasicMealsForTime('Desayuno'),
            'Comida': this.getBasicMealsForTime('Comida'),
            'Colación': this.getBasicMealsForTime('Colación'),
            'Cena': this.getBasicMealsForTime('Cena')
        };
    }

    private getBasicMealsForTime(timeOfDay: string): string[] {
        const basicMeals: { [key: string]: string[] } = {
            'Desayuno': [
                'Huevos revueltos con vegetales',
                'Omelette de claras',
                'Avena con frutas',
                'Yogurt con nueces',
                'Tostadas integrales'
            ],
            'Comida': [
                'Pechuga de pollo asada',
                'Pescado a la plancha',
                'Bistec con ensalada',
                'Pollo con vegetales',
                'Atún con verduras'
            ],
            'Colación': [
                'Yogurt griego',
                'Fruta con proteína',
                'Nueces mixtas',
                'Vegetales frescos',
                'Gelatina natural'
            ],
            'Cena': [
                'Ensalada con proteína',
                'Sopa de vegetales',
                'Omelet ligero',
                'Pescado al vapor',
                'Pollo ligero'
            ]
        };

        return basicMeals[timeOfDay] || basicMeals['Comida'];
    }

    async generateSection(
        section: string, 
        params: MealPlanParams, 
        exactMealNames: any,
        usedMeals: string[],
        attempt: number = 1
    ): Promise<string> {
        const macroRules = MACRONUTRIENT_RULES[params.objetivo] || MACRONUTRIENT_RULES['Mantenimiento'];
        const dietRules = DIET_TYPE_RULES[params.tipo_dieta] || DIET_TYPE_RULES['Balanceada'];
        const targetCalories = params.tmb + macroRules.caloriasAjuste;
        const recentUsedMeals = usedMeals.slice(-10);

        // Lista de ingredientes prohibidos
        const allProhibitedIngredients = [
            ...dietRules.prohibited_ingredients,
            ...(params.alimentos_evitar || [])
        ];

        const response = await this.openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0.2,
            max_tokens: 6000,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `Eres un nutriólogo experto que genera planes alimentarios coherentes y precisos.

        REGLAS UNIVERSALES DE GENERACIÓN:

        1. INGREDIENTES PROHIBIDOS - NUNCA INCLUIR:
        ${allProhibitedIngredients.map(ing => `   • ${ing}`).join('\n')}

        2. NOMBRES DE PLATILLOS DISPONIBLES:
        ${Object.entries(exactMealNames).map(([tiempo, comidas]: [string, any]) => 
            `   ${tiempo}: ${Array.isArray(comidas) ? comidas.slice(0, 8).join(', ') : 'No disponible'}`
        ).join('\n')}

        3. EVITAR REPETICIÓN: ${recentUsedMeals.join(', ')}

        4. COHERENCIA ABSOLUTA NOMBRE-INGREDIENTES:

        REGLA DE ORO OBLIGATORIA:
        SI EL NOMBRE MENCIONA UN INGREDIENTE → ESE INGREDIENTE DEBE ESTAR EN LA LISTA
        SI UN INGREDIENTE ESTÁ EN LA LISTA → DEBE TENER RELACIÓN CON EL NOMBRE

        ERRORES ABSOLUTAMENTE PROHIBIDOS (EJEMPLOS DE TU HISTORIAL):
        ❌ "Moras frescas con coco" + bistec de res → NUNCA HACER ESTO
        ❌ "Bistec encebollado" sin bistec → NUNCA HACER ESTO  
        ❌ "Espinaca" y "espinacas" en el mismo platillo → NUNCA HACER ESTO
        ❌ "Fresas con crema" sin fresas → NUNCA HACER ESTO

        ANTES DE INCLUIR CUALQUIER INGREDIENTE PREGÚNTATE:
        1. ¿Este ingrediente está mencionado en el nombre? SI → Incluir / NO → ir a pregunta 2
        2. ¿Este ingrediente es necesario para preparar el platillo? SI → Incluir / NO → NO incluir

        REGLA ESPECIAL PARA SNACKS DULCES:
        "Moras/fresas/frutas con X" → SOLO incluir: fruta + ingredientes dulces mencionados
        PROHIBIDO agregar: carnes, pescados, o proteínas cárnicas en snacks dulces

        INGREDIENTES CRÍTICOS QUE NUNCA DEBEN FALTAR:
        • "Fresas" en el nombre → DEBE incluir fresas
        • "Queso fresco" en el nombre → DEBE incluir queso fresco
        • "Bistec" en el nombre → DEBE incluir bistec de res
        • "Ajo" en el nombre → DEBE incluir ajo
        • "Caldo" en el nombre → DEBE incluir caldo/líquido base
        • "Crema" en el nombre → DEBE incluir el tipo de crema mencionado

        INGREDIENTES QUE NUNCA DEBEN AGREGARSE SIN RAZÓN:
        • NO agregar "bistec de res" si el nombre no menciona carne de res
        • NO agregar proteínas cárnicas en snacks dulces/frutas
        • NO incluir AMBAS proteínas si el nombre dice "pollo o res" (elegir UNA)
        • NO duplicar ingredientes (ej: "lechuga" y "lechuga romana" juntas)

        MATRIZ DE VALIDACIÓN POR TIPO DE PLATILLO:

        a) PROTEÍNAS:
        - "Pollo" → pechuga de pollo
        - "Res/bistec" → bistec de res
        - "Albóndigas de res" → carne de res molida (NO bistec)
        - "Pescado" → filete de pescado
        - "Pavo" → pechuga de pavo
        - Si dice "pollo o res" → elegir SOLO UNA, nunca ambas

        b) PLATILLOS LÍQUIDOS:
        - "Caldo/sopa" → DEBE incluir líquido base (caldo/agua) + ingredientes sólidos
        - "Crema de X" → DEBE incluir líquido base (leche/crema) + ingrediente X
        - "Jugo/licuado" → DEBE incluir líquido base + frutas/verduras mencionadas

        c) PLATILLOS CON MASA:
        - "Crepas" → harina específica + huevos + líquido base
        - "Enchiladas" → tortilla/sustituto + relleno + salsa
        - "Tortilla de nopal" → debe aparecer en ingredientes

        d) ENSALADAS:
        - Base verde (lechuga/espinaca) + ingredientes específicos del nombre
        - NO agregar proteínas no mencionadas
        - Si menciona aderezo, incluirlo

        e) SNACKS Y COLACIONES:
        - Solo incluir lo mencionado en el nombre
        - "Fresas con crema" → fresas + tipo de crema mencionado
        - "Moras con coco" → moras + coco rallado (NUNCA agregar carnes)

        5. HOMOLOGACIÓN DE PORCIONES:
        • Huevos → "piezas" (nunca "unidades")
        • Carnes/pescados → "g" (nunca "gramos")  
        • Verduras/frutas grandes → "pieza"
        • Aceitunas → "piezas" (nunca "unidades")
        • Líquidos → "ml" o "taza"
        • Condimentos → "al gusto" o "cucharadita"

        6. REGLAS NUTRICIONALES:
        ${NUTRITION_RULES}

        ALGORITMO DE VALIDACIÓN OBLIGATORIA (ejecutar antes de incluir cada platillo):

        PASO 1 - EXTRACCIÓN: 
        Lista todos los ingredientes mencionados explícitamente en el nombre
        Ejemplo: "Fresas con crema light y canela" → [fresas, crema light, canela]

        PASO 2 - VERIFICACIÓN DE COMPLETITUD:
        ¿Cada ingrediente extraído en PASO 1 aparece en la lista de ingredientes? 
        Si falta alguno → RECHAZAR platillo

        PASO 3 - VERIFICACIÓN DE COHERENCIA:
        ¿Cada ingrediente en la lista tiene relación lógica directa con el nombre?
        Si hay ingredientes sin relación → RECHAZAR platillo

        PASO 4 - VERIFICACIÓN DE PROHIBIDOS:
        ¿Algún ingrediente está en la lista de prohibidos?
        Si existe → RECHAZAR platillo

        PASO 5 - VERIFICACIÓN DE DUPLICADOS:
        ¿Hay ingredientes repetidos con nombres similares?
        Ejemplos de duplicados PROHIBIDOS:
        - "espinaca" + "espinacas" en el mismo platillo
        - "lechuga" + "lechuga romana" en el mismo platillo  
        - "pavo" + "pechuga de pavo" en el mismo platillo
        SOLUCIÓN: Usar SOLO UNA versión del ingrediente
        Si existen duplicados → RECHAZAR platillo

        PASO 6 - VERIFICACIÓN DE HOMOLOGACIÓN:
        ¿Las unidades de medida son correctas?
        Si hay errores → RECHAZAR platillo

        PASO 7 - VERIFICACIÓN DE LÓGICA CULINARIA:
        ¿El platillo es preparable y nutritivo con esos ingredientes?
        Si no tiene sentido → RECHAZAR platillo

        EJEMPLOS COMPLETOS DE VALIDACIÓN:

        ✅ CORRECTO: "Filete de pescado al mojo de ajo"
        PASO 1: [pescado, ajo]
        PASO 2: ✓ Incluye filete de pescado y ajo
        PASO 3: ✓ Base verde opcional es coherente
        PASO 4: ✓ Ninguno prohibido
        PASO 5: ✓ Sin duplicados
        PASO 6: ✓ Pescado en "g"
        PASO 7: ✓ Platillo lógico
        INGREDIENTES: filete de pescado 150g, ajo 2 dientes, lechuga romana 1 taza
        RESULTADO: ✅ APROBADO

        ✅ CORRECTO: "Fresas con crema light y canela"
        PASO 1: [fresas, crema light, canela]
        PASO 2: ✓ Incluye fresas, crema light y canela
        PASO 3: ✓ Todos coherentes
        PASO 4: ✓ Ninguno prohibido
        PASO 5: ✓ Sin duplicados
        PASO 6: ✓ Medidas correctas
        PASO 7: ✓ Snack lógico
        INGREDIENTES: fresas 100g, crema light 50ml, canela 1 cucharadita
        RESULTADO: ✅ APROBADO

        ❌ INCORRECTO: "Moras frescas con coco rallado sin azúcar"
        INGREDIENTES PROPUESTOS: coco rallado, bistec de res, moras
        PASO 1: [moras, coco rallado, sin azúcar]
        PASO 2: ✓ Incluye moras y coco
        PASO 3: ✗ "Bistec de res" NO tiene relación con un snack de frutas
        RESULTADO: ❌ RECHAZADO - El bistec NO pertenece en este platillo

        ❌ INCORRECTO: "Ensalada de espinaca con queso"
        INGREDIENTES PROPUESTOS: espinaca, queso, espinacas, lechuga romana
        PASO 1: [espinaca, queso]
        PASO 2: ✓ Incluye espinaca y queso
        PASO 5: ✗ "espinaca" y "espinacas" son duplicados
        RESULTADO: ❌ RECHAZADO - Usar SOLO "espinacas", eliminar "espinaca"

        ❌ INCORRECTO: "Fresas con crema light"
        INGREDIENTES PROPUESTOS: crema light, canela
        PASO 1: [fresas, crema light]
        PASO 2: ✗ Faltan las FRESAS
        RESULTADO: ❌ RECHAZADO - Agregar fresas obligatoriamente

        ❌ INCORRECTO: "Bistec encebollado con nopales"
        INGREDIENTES PROPUESTOS: cebolla, nopales, jitomate
        PASO 1: [bistec, cebolla, nopales]
        PASO 2: ✗ Falta el BISTEC
        RESULTADO: ❌ RECHAZADO - Agregar bistec de res

        ❌ INCORRECTO: "Caldo de pollo con verduras"
        INGREDIENTES PROPUESTOS: pechuga de pollo, calabacitas, espinacas
        PASO 1: [caldo, pollo, verduras]
        PASO 2: ✗ Falta el CALDO (líquido base)
        RESULTADO: ❌ RECHAZADO - Agregar caldo de pollo o agua

        FORMATO JSON (sin markdown):
        {
            "${section}": {
                "Desayuno": {
                    "Opcion 1": {
                        "nombre": "NOMBRE_EXACTO_DE_LA_LISTA",
                        "ingredientes": [
                            {"nombre": "ingrediente1_del_nombre", "porcion": "cantidad_homologada"},
                            {"nombre": "ingrediente2_del_nombre", "porcion": "cantidad_homologada"}
                        ],
                        "preparacion": "Método usando todos los ingredientes listados"
                    },
                    "Opcion 2": { ... },
                    "Opcion 3": { ... }
                },
                "Comida": {
                    "Opcion 1": {...}, "Opcion 2": {...}, "Opcion 3": {...}
                },
                "Colación": {
                    "Opcion 1": {...}, "Opcion 2": {...}, "Opcion 3": {...}
                },
                "Cena": {
                    "Opcion 1": {...}, "Opcion 2": {...}, "Opcion 3": {...}
                }
            }
        }`
                },
                {
                    role: "user",
                    content: `Genera la sección "${section}" del plan alimentario.
            FORMATO DE RESPUESTA CRÍTICO:
            Responde ÚNICAMENTE con el objeto JSON puro.
            NO uses bloques de código markdown (NO uses \`\`\`json o \`\`\`).
            NO agregues explicaciones, texto introductorio, ni comentarios.
            La respuesta DEBE comenzar directamente con { y terminar con }.

            PROCESO OBLIGATORIO PARA CADA PLATILLO:
            1. Lee el nombre del platillo
            2. Extrae TODOS los ingredientes mencionados explícitamente
            3. Verifica que TODOS esos ingredientes estén en la lista
            4. Verifica que NO haya ingredientes sin relación lógica
            5. Ejecuta los 7 pasos de validación
            6. Si falla cualquier paso → RECHAZA y genera alternativa
            7. Solo si pasa todos los pasos → INCLUYE el platillo

            CASOS ESPECIALES CRÍTICOS (ERRORES HISTÓRICOS A EVITAR):
            - "Fresas/moras/frutas con X" → DEBE incluir la fruta mencionada + NUNCA agregar carnes
            - "Moras con coco" + bistec → ERROR GRAVE PROHIBIDO
            - "Queso fresco/panela/feta" → DEBE incluir el tipo específico de queso
            - "Bistec/pollo/pescado/pavo" → DEBE incluir la proteína específica mencionada
            - "Bistec encebollado" → DEBE incluir bistec + cebolla
            - "Caldo/crema de X" → DEBE incluir líquido base + ingrediente X
            - "Al mojo de ajo" → DEBE incluir ajo
            - "Encebollado" → DEBE incluir cebolla
            - "Platillo o/con ensalada" → NO incluir proteínas no mencionadas en ensaladas
            - Nunca duplicar: "espinaca" + "espinacas" / "lechuga" + "lechuga romana"

            FORMATO DE RESPUESTA OBLIGATORIO:
            CADA platillo DEBE incluir:
            1. "nombre": "Nombre exacto del platillo"
            2. "ingredientes": [lista completa]
            3. "preparacion": "Método de preparación"

            NUNCA omitas el nombre o la preparación.

            VERIFICACIÓN FINAL ANTES DE RESPONDER:
            Revisa cada uno de los 12 platillos y confirma que:
            □ Cada ingrediente del nombre está en la lista
            □ No hay ingredientes sin relación directa con el nombre
            □ No hay duplicados
            □ Las porciones están homologadas
            □ No hay ingredientes prohibidos: ${allProhibitedIngredients.join(', ')}

            Si encuentras un error en cualquier platillo, DEBES corregirlo antes de entregar la respuesta.

            Intento ${attempt}/3.

            ESTRUCTURA JSON REQUERIDA (sin markdown, sin bloques de código):
            {"${section}": {"Desayuno": {...}, "Comida": {...}, "Colación": {...}, "Cena": {...}}}

            RESPONDE SOLO CON EL JSON. SIN TEXTO ADICIONAL. SIN MARKDOWN.`
                }
            ]
        });

        return response.choices[0]?.message?.content || '';
    }

    private async generateSectionWithRateLimit(
        section: string, 
        params: MealPlanParams, 
        exactMealNames: any,
        usedMeals: string[],
        attempt: number
    ): Promise<string> {
        try {
            return await this.generateSection(section, params, exactMealNames, usedMeals, attempt);
        } catch (error: any) {
            if (error.message?.includes('rate_limit_exceeded') || error.message?.includes('429')) {
                const waitTime = attempt * 5000;
                console.log(`Rate limit, esperando ${waitTime/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return await this.generateSection(section, params, exactMealNames, usedMeals, attempt);
            }
            throw error;
        }
    }

    private validateSectionData(sectionData: any, exactMealNames: any, usedMeals: string[], attempt: number, maxAttempts: number, params: MealPlanParams) {
        const warnings: string[] = [];
        const issues: string[] = [];
        let level = 'strict';
        
        const cleanedData = this.removeDuplicatesWithinSection(sectionData, warnings);
        const finalData = this.validateAndFixIngredients(cleanedData, exactMealNames, usedMeals, attempt, maxAttempts, warnings, issues, params);
        
        // Ser más permisivo gradualmente
        const isAcceptable = attempt >= 2 || issues.length === 0;
        
        if (attempt >= 2) {
            level = attempt === 2 ? 'flexible' : 'ultra_permissive';
        }
        
        return {
            isAcceptable,
            cleanedData: finalData,
            level,
            warnings,
            issues
        };
    }

    private validateAndFixIngredients(sectionData: any, exactMealNames: any, usedMeals: string[], attempt: number, maxAttempts: number, warnings: string[], issues: string[], params: MealPlanParams) {
        const processedData = JSON.parse(JSON.stringify(sectionData));
        
        for (const [timeOfDay, options] of Object.entries(processedData)) {
            if (timeOfDay === 'Hidratación') continue;
            
            if (!options || typeof options !== 'object') {
                processedData[timeOfDay] = this.generateMissingMealTime(timeOfDay, exactMealNames, usedMeals, params);
                warnings.push(`Tiempo de comida regenerado: ${timeOfDay}`);
                continue;
            }
            
            const availableNames = exactMealNames[timeOfDay] || [];
            const unusedNames = availableNames.filter((name: string) => !usedMeals.includes(name));
            const namesToUse = unusedNames.length >= 3 ? unusedNames : availableNames;
            
            for (const [optionKey, meal] of Object.entries(options as any)) {
                const mealObj = meal as any;
                
                if (!mealObj?.nombre) {
                    mealObj.nombre = this.getNextAvailableMeal(namesToUse, timeOfDay, optionKey, usedMeals);
                    warnings.push(`Nombre faltante asignado: ${mealObj.nombre}`);
                }
                
                // VALIDAR Y CORREGIR INGREDIENTES
                if (!mealObj.ingredientes || !Array.isArray(mealObj.ingredientes)) {
                    mealObj.ingredientes = this.generateCorrectIngredients(mealObj.nombre, timeOfDay, params);
                    warnings.push(`Ingredientes regenerados para: ${mealObj.nombre}`);
                } else {
                    // Verificar coherencia ingredientes-nombre
                    const isCoherent = this.validateIngredientCoherence(mealObj.nombre, mealObj.ingredientes);
                    if (!isCoherent) {
                        mealObj.ingredientes = this.generateCorrectIngredients(mealObj.nombre, timeOfDay, params);
                        warnings.push(`Ingredientes corregidos para coherencia: ${mealObj.nombre}`);
                    }
                    
                    // NUEVA VALIDACIÓN: Usar las reglas nutricionales actualizadas
                    const validation = validateMealAgainstRules(
                        mealObj.nombre,
                        mealObj.ingredientes,
                        timeOfDay,
                        params.tipo_dieta,
                        params.objetivo,
                        params.alimentos_evitar || []
                    );

                    if (!validation.isValid) {
                        if (validation.correctedIngredients) {
                            mealObj.ingredientes = validation.correctedIngredients;
                            warnings.push(`Ingredientes corregidos por reglas nutricionales: ${mealObj.nombre} - ${validation.violations.join(', ')}`);
                        } else {
                            // Si no hay ingredientes corregidos, regenerar completamente
                            mealObj.ingredientes = this.generateCorrectIngredients(mealObj.nombre, timeOfDay, params);
                            warnings.push(`Ingredientes regenerados por violaciones: ${mealObj.nombre}`);
                        }
                    }
                }
                
                // Validar preparación
                if (!mealObj.preparacion) {
                    mealObj.preparacion = this.generateCorrectPreparation(mealObj.nombre, mealObj.ingredientes);
                    warnings.push(`Preparación regenerada para: ${mealObj.nombre}`);
                }
            }
            
            this.ensureThreeUniqueOptions(processedData[timeOfDay], timeOfDay, namesToUse, usedMeals, params, warnings);
        }
        
        /*
        if (!processedData["Hidratación"]) {
            processedData["Hidratación"] = {
                "recomendaciones": "Beber al menos 2 litros de agua al día."
            };
        }
        */
        
        return processedData;
    }

    private validateIngredientCoherence(mealName: string, ingredientes: any[]): boolean {
        if (!mealName || !ingredientes || ingredientes.length === 0) return false;
        
        const mealNameLower = mealName.toLowerCase();
        const ingredientNames = ingredientes.map(ing => ing.nombre?.toLowerCase() || '');
        
        // Mapeo de nombres de comidas a ingredientes esperados
        const expectedIngredients: { [key: string]: string[] } = {
            'yogurt': ['yogurt'],
            'huevo': ['huevo'],
            'avena': ['avena'],
            'pollo': ['pollo', 'pechuga'],
            'pescado': ['pescado', 'salmón', 'atún'],
            'ensalada': ['lechuga', 'tomate', 'pepino'],
            'licuado': ['leche', 'fruta'],
            'tostada': ['pan', 'tostada'],
            'apio': ['apio'],
            'pepino': ['pepino'],
            'manzana': ['manzana'],
            'fresas': ['fresas', 'fresa']
        };
        
        // Buscar palabras clave del nombre en ingredientes esperados
        for (const [key, expected] of Object.entries(expectedIngredients)) {
            if (mealNameLower.includes(key)) {
                const hasExpectedIngredient = expected.some(exp => 
                    ingredientNames.some(ing => ing.includes(exp))
                );
                if (!hasExpectedIngredient) {
                    return false;
                }
            }
        }
        
        return true;
    }

    private hasProhibitedIngredients(ingredientes: any[], avoidedIngredients: string[]): {hasProhibited: boolean, prohibited: string[]} {
        const prohibited: string[] = [];
        
        for (const ingredient of ingredientes) {
            const ingredientName = ingredient.nombre?.toLowerCase() || '';
            for (const avoided of avoidedIngredients) {
                if (ingredientName.includes(avoided.toLowerCase())) {
                    prohibited.push(ingredient.nombre);
                }
            }
        }
        
        return {
            hasProhibited: prohibited.length > 0,
            prohibited
        };
    }

    private removeProhibitedIngredients(ingredientes: any[], avoidedIngredients: string[]): any[] {
        return ingredientes.filter(ingredient => {
            const ingredientName = ingredient.nombre?.toLowerCase() || '';
            return !avoidedIngredients.some(avoided => 
                ingredientName.includes(avoided.toLowerCase())
            );
        });
    }

    private generateCorrectIngredients(mealName: string, timeOfDay: string, params: MealPlanParams): any[] {
        const macroRules = MACRONUTRIENT_RULES[params.objetivo] || MACRONUTRIENT_RULES['Mantenimiento'];
        const ingredients = [];
        const mealNameLower = mealName.toLowerCase();
        const avoidedLower = params.alimentos_evitar?.map(item => item.toLowerCase()) || [];
        
        // Licuados y bebidas
        if (mealNameLower.includes('licuado')) {
            if (mealNameLower.includes('verde')) {
                ingredients.push({ nombre: "Espinacas", porcion: "1 taza" });
                ingredients.push({ nombre: "Agua", porcion: "200ml" });
            }
            if (mealNameLower.includes('piña')) {
                ingredients.push({ nombre: "Piña", porcion: "1 taza" });
            }
            if (mealNameLower.includes('proteico') || mealNameLower.includes('protein')) {
                if (!avoidedLower.includes('proteína')) {
                    ingredients.push({ nombre: "Proteína en polvo", porcion: "1 scoop" });
                }
            }
            // Base líquida si no se agregó agua
            if (!ingredients.some(ing => ing.nombre.toLowerCase().includes('agua'))) {
                ingredients.push({ nombre: "Agua", porcion: "250ml" });
            }
        }
        
        // Generar ingredientes basados en el nombre (código existente...)
        if (mealNameLower.includes('yogurt')) {
            if (!avoidedLower.includes('yogurt')) {
                ingredients.push({ nombre: "Yogurt griego", porcion: "150g" });
            }
        }
        
        if (mealNameLower.includes('almendras')) {
            if (!avoidedLower.includes('almendras')) {
                ingredients.push({ nombre: "Almendras", porcion: "15g" });
            }
        }
        
        if (mealNameLower.includes('huevo')) {
            if (!avoidedLower.includes('huevo')) {
                ingredients.push({ nombre: "Huevos", porcion: "2 piezas" });
            }
        }
        
        if (mealNameLower.includes('apio')) {
            ingredients.push({ nombre: "Apio", porcion: "2 tallos" });
            ingredients.push({ nombre: "Limón", porcion: "10ml" });
            ingredients.push({ nombre: "Sal", porcion: "1 pizca" });
        }
        
        if (mealNameLower.includes('pepino')) {
            ingredients.push({ nombre: "Pepinos", porcion: "100g" });
            ingredients.push({ nombre: "Limón", porcion: "10ml" });
        }
        
        if (mealNameLower.includes('manzana')) {
            ingredients.push({ nombre: "Manzana", porcion: "1 pieza" });
        }
        
        if (mealNameLower.includes('fresas')) {
            ingredients.push({ nombre: "Fresas", porcion: "100g" });
            if (mealNameLower.includes('crema')) {
                ingredients.push({ nombre: "Crema baja en grasa", porcion: "2 cucharadas" });
            }
        }
        
        // Ensaladas
        if (mealNameLower.includes('ensalada')) {
            ingredients.push({ nombre: "Lechuga mixta", porcion: "2 tazas" });
            if (mealNameLower.includes('pollo') && !avoidedLower.includes('pollo')) {
                ingredients.push({ nombre: "Pechuga de pollo", porcion: "120g" });
            }
            if (mealNameLower.includes('atún') && !avoidedLower.includes('atún')) {
                ingredients.push({ nombre: "Atún en agua", porcion: "1 lata" });
            }
        }
        
        // Proteínas principales
        if (mealNameLower.includes('pollo')) {
            if (!avoidedLower.includes('pollo')) {
                const amount = this.getProteinAmount(params.objetivo, timeOfDay);
                ingredients.push({ nombre: "Pechuga de pollo", porcion: `${amount}g` });
            }
        }
        
        if (mealNameLower.includes('pescado')) {
            if (!avoidedLower.includes('pescado')) {
                const amount = this.getProteinAmount(params.objetivo, timeOfDay);
                ingredients.push({ nombre: "Filete de pescado", porcion: `${amount}g` });
            }
        }
        
        if (mealNameLower.includes('atún')) {
            if (!avoidedLower.includes('atún')) {
                ingredients.push({ nombre: "Atún en agua", porcion: "1 lata" });
            }
        }
        
        if (mealNameLower.includes('avena')) {
            if (!avoidedLower.includes('avena')) {
                ingredients.push({ nombre: "Avena", porcion: "1/2 taza" });
            }
        }
        
        // Condimentos básicos para la mayoría de comidas
        if (ingredients.length > 1 && !mealNameLower.includes('licuado')) {
            ingredients.push({ nombre: "Sal y pimienta", porcion: "al gusto" });
        }
        
        // Si TODAVÍA no se generaron ingredientes específicos, crear según el tiempo de comida
        if (ingredients.length === 0) {
            const basicIngredients = this.getBasicIngredientsByTime(timeOfDay, avoidedLower);
            ingredients.push(...basicIngredients);
        }
        
        return ingredients;
    }

    // Nueva función auxiliar
    private getBasicIngredientsByTime(timeOfDay: string, avoidedIngredients: string[]): any[] {
        const basicByTime: { [key: string]: any[] } = {
            'Desayuno': [
                { nombre: "Huevos", porcion: "2 piezas" },
                { nombre: "Vegetales frescos", porcion: "1 taza" }
            ],
            'Comida': [
                { nombre: "Proteína magra", porcion: "150g" },
                { nombre: "Vegetales mixtos", porcion: "2 tazas" }
            ],
            'Colación': [
                { nombre: "Fruta de temporada", porcion: "1 pieza" },
                { nombre: "Nueces", porcion: "30g" }
            ],
            'Cena': [
                { nombre: "Vegetales al vapor", porcion: "2 tazas" },
                { nombre: "Proteína ligera", porcion: "120g" }
            ]
        };
        
        const ingredients = basicByTime[timeOfDay] || basicByTime['Comida'];
        
        // Filtrar ingredientes evitados
        return ingredients.filter(ingredient => {
            const ingredientName = ingredient.nombre.toLowerCase();
            return !avoidedIngredients.some(avoided => 
                ingredientName.includes(avoided)
            );
        });
    }

    private generateCorrectPreparation(mealName: string, ingredientes: any[]): string {
        const mealNameLower = mealName.toLowerCase();
        const ingredientNames = ingredientes.map(ing => ing.nombre?.toLowerCase() || '').join(' ');

        if (mealNameLower.includes('licuado')) {
            if (mealNameLower.includes('verde') && mealNameLower.includes('piña')) {
                return "Lavar las espinacas y cortar la piña. Agregar todos los ingredientes a la licuadora y licuar hasta obtener una consistencia homogénea. Servir inmediatamente.";
            } else if (mealNameLower.includes('verde')) {
                return "Lavar bien las espinacas. Agregar todos los ingredientes a la licuadora y licuar hasta obtener una mezcla homogénea y cremosa.";
            } else {
                return "Preparar todos los ingredientes y licuar hasta obtener la consistencia deseada. Servir fresco.";
            }
        }
        
        if (mealNameLower.includes('yogurt') && ingredientNames.includes('almendras')) {
            return "Servir el yogurt griego en un bowl y agregar las almendras picadas por encima.";
        }
        
        if (mealNameLower.includes('apio')) {
            return "Lavar los tallos de apio, cortarlos en bastones y aderezar con limón y sal al gusto.";
        }
        
        if (mealNameLower.includes('pepino')) {
            return "Cortar los pepinos en rodajas, agregar limón y sal. Servir fresco.";
        }
        
        if (mealNameLower.includes('fresas')) {
            return "Lavar las fresas, cortarlas si es necesario y servir con la crema baja en grasa.";
        }
        
        if (mealNameLower.includes('huevo')) {
            return "Cocinar los huevos según la preparación deseada (revueltos, estrellados, etc.).";
        }
        
        return "Preparar todos los ingredientes según el método más saludable para mantener sus propiedades nutricionales.";
    }

    private getProteinAmount(objetivo: string, timeOfDay: string): number {
        const macroRules = MACRONUTRIENT_RULES[objetivo] || MACRONUTRIENT_RULES['Mantenimiento'];
        
        if (timeOfDay === 'Colación') return 100;
        
        const min = macroRules.protein_per_meal_min || 120;
        const max = macroRules.protein_per_meal_max || 180;
        
        return Math.floor((min + max) / 2);
    }

    private getNextAvailableMeal(namesToUse: string[], timeOfDay: string, optionKey: string, usedMeals: string[]): string {
        const availableUnused = namesToUse.filter(name => !usedMeals.includes(name));
        const finalList = availableUnused.length > 0 ? availableUnused : namesToUse;
        
        if (finalList.length === 0) {
            return this.generateAcceptableMealName(timeOfDay, optionKey);
        }
        
        const optionIndex = parseInt(optionKey.replace('Opcion ', '')) - 1;
        return finalList[optionIndex % finalList.length];
    }

    private generateAcceptableMealName(timeOfDay: string, optionKey: string): string {
        const optionNumber = optionKey.replace('Opcion ', '');
        
        const mealPatterns: { [key: string]: string[] } = {
            'Desayuno': [
                'Huevos revueltos con vegetales',
                'Omelette de claras',
                'Avena con frutas'
            ],
            'Comida': [
                'Pechuga de pollo asada',
                'Pescado a la plancha',
                'Bistec con ensalada'
            ],
            'Colación': [
                'Yogurt con nueces',
                'Fruta con proteína',
                'Vegetales frescos'
            ],
            'Cena': [
                'Ensalada con proteína',
                'Sopa de vegetales',
                'Omelet ligero'
            ]
        };
        
        const patterns = mealPatterns[timeOfDay] || mealPatterns['Comida'];
        const patternIndex = (parseInt(optionNumber) - 1) % patterns.length;
        
        return patterns[patternIndex];
    }

    private ensureThreeUniqueOptions(timeOptions: any, timeOfDay: string, namesToUse: string[], usedMeals: string[], params: MealPlanParams, warnings: string[]) {
        const usedInThisTime: string[] = [];
        
        for (let i = 1; i <= 3; i++) {
            const optionKey = `Opcion ${i}`;
            
            if (!timeOptions[optionKey] || !timeOptions[optionKey].nombre) {
                const mealName = this.getUniqueAvailableMeal(namesToUse, usedMeals, usedInThisTime, timeOfDay, optionKey);
                
                timeOptions[optionKey] = {
                    "nombre": mealName,
                    "ingredientes": this.generateCorrectIngredients(mealName, timeOfDay, params),
                    "preparacion": this.generateCorrectPreparation(mealName, [])
                };
                
                warnings.push(`Opción completa generada: ${optionKey} - ${mealName}`);
            }
            
            usedInThisTime.push(timeOptions[optionKey].nombre);
        }
    }

    private getUniqueAvailableMeal(namesToUse: string[], globalUsed: string[], localUsed: string[], timeOfDay: string, optionKey: string): string {
        const available = namesToUse.filter(name => 
            !globalUsed.includes(name) && !localUsed.includes(name)
        );
        
        if (available.length > 0) {
            return available[0];
        }
        
        // Si no hay únicos globalmente, al menos únicos localmente
        const locallyAvailable = namesToUse.filter(name => !localUsed.includes(name));
        if (locallyAvailable.length > 0) {
            return locallyAvailable[0];
        }
        
        // Último recurso
        return this.generateAcceptableMealName(timeOfDay, optionKey);
    }

    private removeDuplicatesWithinSection(sectionData: any, warnings: string[]) {
        const cleaned = JSON.parse(JSON.stringify(sectionData));
    
        for (const [timeOfDay, options] of Object.entries(cleaned)) {
            if (timeOfDay === 'Hidratación') continue;
            
            const usedNamesInTime: string[] = [];
            
            for (const [optionKey, meal] of Object.entries(options as any)) {
                const mealObj = meal as any;
                
                if (mealObj?.nombre) {
                    if (usedNamesInTime.includes(mealObj.nombre)) {
                        const alternativeName = this.findAlternativeName(mealObj.nombre, usedNamesInTime);
                        const oldName = mealObj.nombre;
                        mealObj.nombre = alternativeName;
                        warnings.push(`Duplicado local corregido: "${oldName}" → "${alternativeName}" en ${timeOfDay}`);
                    }
                    usedNamesInTime.push(mealObj.nombre);
                }
            }
        }
        
        return cleaned;
    }

    private findAlternativeName(originalName: string, usedNames: string[]): string {
        const variations = [
            `${originalName} especial`,
            `${originalName} casero`,
            `${originalName} light`,
            `Variación de ${originalName}`
        ];
        
        for (const variation of variations) {
            if (!usedNames.includes(variation)) {
                return variation;
            }
        }
        
        return `${originalName} (v${usedNames.length + 1})`;
    }

    private generateMissingMealTime(timeOfDay: string, exactMealNames: any, usedMeals: string[], params: MealPlanParams) {
        const availableMeals = exactMealNames[timeOfDay] || [];
        const unusedMeals = availableMeals.filter((meal: string) => !usedMeals.includes(meal));
        const mealsToUse = unusedMeals.length >= 3 ? unusedMeals : availableMeals;
        
        const mealTime: any = {};
        
        for (let i = 1; i <= 3; i++) {
            const mealIndex = (i - 1) % Math.max(mealsToUse.length, 1);
            const mealName = mealsToUse[mealIndex] || this.generateAcceptableMealName(timeOfDay, `Opcion ${i}`);
            
            mealTime[`Opcion ${i}`] = {
                "nombre": mealName,
                "ingredientes": this.generateCorrectIngredients(mealName, timeOfDay, params),
                "preparacion": this.generateCorrectPreparation(mealName, [])
            };
        }
        
        return mealTime;
    }

    private validateForbiddenIngredients(content: string, forbiddenFoods: string[]): {isValid: boolean, violations: string[]} {
        if (!forbiddenFoods || forbiddenFoods.length === 0) {
            return { isValid: true, violations: [] };
        }

        const violations: string[] = [];
        const contentLower = content.toLowerCase();
        
        for (const forbidden of forbiddenFoods) {
            const forbiddenLower = forbidden.toLowerCase().trim();
            const pattern = new RegExp(`\\b${forbiddenLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            
            if (pattern.test(contentLower)) {
                violations.push(forbidden);
            }
        }
        
        return {
            isValid: violations.length === 0,
            violations
        };
    }


    private generateEmergencyPlan(section: string, availableMeals: any, params: MealPlanParams) {
        const plan: any = {
            "Hidratación": {
                "recomendaciones": "Beber al menos 2 litros de agua al día."
            }
        };
        
        const mealTimes = ['Desayuno', 'Comida', 'Colación', 'Cena'];
        
        for (const timeOfDay of mealTimes) {
            plan[timeOfDay] = {};
            const meals = availableMeals[timeOfDay] || [];
            
            for (let i = 1; i <= 3; i++) {
                const mealIndex = (i - 1) % Math.max(meals.length, 1);
                const mealName = meals[mealIndex] || this.generateAcceptableMealName(timeOfDay, `Opcion ${i}`);
                
                plan[timeOfDay][`Opcion ${i}`] = {
                    "nombre": mealName,
                    "ingredientes": this.generateCorrectIngredients(mealName, timeOfDay, params),
                    "preparacion": this.generateCorrectPreparation(mealName, [])
                };
            }
        }
        
        return plan;
    }

    private generateGenericPlan(section: string, params: MealPlanParams) {
        const plan = {
            "Desayuno": {
                "Opcion 1": {
                    "nombre": "Desayuno balanceado",
                    "ingredientes": this.generateCorrectIngredients("Huevos con vegetales", "Desayuno", params),
                    "preparacion": "Preparar de forma saludable"
                },
                "Opcion 2": {
                    "nombre": "Desayuno energético", 
                    "ingredientes": this.generateCorrectIngredients("Avena con frutas", "Desayuno", params),
                    "preparacion": "Combinar ingredientes"
                },
                "Opcion 3": {
                    "nombre": "Desayuno nutritivo",
                    "ingredientes": this.generateCorrectIngredients("Yogurt con nueces", "Desayuno", params),
                    "preparacion": "Mezclar y servir"
                }
            },
            "Comida": {
                "Opcion 1": {
                    "nombre": "Comida completa",
                    "ingredientes": this.generateCorrectIngredients("Pollo con vegetales", "Comida", params),
                    "preparacion": "Cocinar saludablemente"
                },
                "Opcion 2": {
                    "nombre": "Comida balanceada",
                    "ingredientes": this.generateCorrectIngredients("Pescado con ensalada", "Comida", params),
                    "preparacion": "Preparar balanceadamente"
                },
                "Opcion 3": {
                    "nombre": "Comida nutritiva",
                    "ingredientes": this.generateCorrectIngredients("Carne con vegetales", "Comida", params),
                    "preparacion": "Asar y combinar"
                }
            },
            "Colación": {
                "Opcion 1": {
                    "nombre": "Snack proteico",
                    "ingredientes": this.generateCorrectIngredients("Yogurt griego", "Colación", params),
                    "preparacion": "Servir fresco"
                },
                "Opcion 2": {
                    "nombre": "Snack natural",
                    "ingredientes": this.generateCorrectIngredients("Fruta fresca", "Colación", params),
                    "preparacion": "Lavar y consumir"
                },
                "Opcion 3": {
                    "nombre": "Snack balanceado",
                    "ingredientes": this.generateCorrectIngredients("Nueces mixtas", "Colación", params),
                    "preparacion": "Porcionar adecuadamente"
                }
            },
            "Cena": {
                "Opcion 1": {
                    "nombre": "Cena ligera",
                    "ingredientes": this.generateCorrectIngredients("Ensalada con proteína", "Cena", params),
                    "preparacion": "Mezclar y aderezar"
                },
                "Opcion 2": {
                    "nombre": "Cena balanceada",
                    "ingredientes": this.generateCorrectIngredients("Sopa de vegetales", "Cena", params),
                    "preparacion": "Cocinar hasta tierno"
                },
                "Opcion 3": {
                    "nombre": "Cena nutritiva",
                    "ingredientes": this.generateCorrectIngredients("Omelet de vegetales", "Cena", params),
                    "preparacion": "Batir y cocinar"
                }
            },
            "Hidratación": {
                "recomendaciones": "Mantener hidratación adecuada con al menos 2 litros de agua diaria."
            }
        };
        
        return plan;
    }

    private isSimilarMealName(mealName: string, availableNames: string[]): boolean {
        const normalize = (str: string) => str.toLowerCase().replace(/[^a-z\s]/g, '').trim();
        const normalizedMeal = normalize(mealName);
        
        return availableNames.some(available => {
            const normalizedAvailable = normalize(available);
            const mealWords = normalizedMeal.split(' ');
            const availableWords = normalizedAvailable.split(' ');
            
            const commonWords = mealWords.filter(word => 
                availableWords.some(aw => aw.includes(word) || word.includes(aw))
            );
            
            return commonWords.length >= Math.min(mealWords.length, availableWords.length) * 0.6;
        });
    }

    private async analyzeAndCorrectCompletePlan(plan: any, params: MealPlanParams): Promise<any> {
        console.log(`📋 Validación final del plan completo...`);
        
        // Solo validación estructural, sin llamadas a IA
        const finalValidation = this.validateCompletePlanStructure(plan);
        
        if (finalValidation.hasIssues) {
            console.log(`⚠️ Issues detectados: ${finalValidation.issues.length}`);
            console.log(`Primer issue: ${finalValidation.issues[0]}`);
        } else {
            console.log(`✅ Plan completo validado correctamente`);
        }
        
        return plan;
    }

    private async analyzePlanWithIA(plan: any, params: MealPlanParams): Promise<{hasErrors: boolean, errors: string[]}> {
        const analysisResponse = await this.openai.chat.completions.create({
            model: "gpt-4-turbo",
            temperature: 0.1,
            max_tokens: 2000,
            messages: [{
                role: "user",
                content: `Analiza este plan alimentario y detecta errores críticos usando principios universales:

    ERRORES UNIVERSALES A DETECTAR:

    1. INCOHERENCIA NOMBRE-INGREDIENTES:
    - ¿Falta algún ingrediente principal mencionado en el nombre del platillo?
    - ¿Hay ingredientes que no tienen relación lógica con el platillo?

    2. INCOMPATIBILIDADES CATEGÓRICAS:
    - ¿Platillos dulces (moras, fresas, chocolate) tienen proteínas cárnicas?
    - ¿Snacks simples tienen elementos complejos no relacionados?

    3. INGREDIENTES PROHIBIDOS:
    Usuario evita: ${params.alimentos_evitar?.join(', ') || 'Ninguno'}
    Dieta ${params.tipo_dieta} prohíbe: ${DIET_TYPE_RULES[params.tipo_dieta]?.prohibited_ingredients?.join(', ') || 'Ninguno'}

    4. DUPLICADOS O REDUNDANCIAS:
    - ¿Mismo ingrediente listado múltiples veces en una comida?
    - ¿Términos genéricos redundantes como "ensalada fresca" + "lechuga romana"?

    5. UNIDADES NO ESTÁNDAR:
    - ¿Huevos con "unidades" en lugar de "piezas"?
    - ¿Carnes con "gramos" en lugar de "g"?

    PRINCIPIOS DE ANÁLISIS:
    - Enfócate en errores que afectan la coherencia del plan
    - Detecta incompatibilidades obvias entre categorías de alimentos
    - Identifica ingredientes que claramente no pertenecen al platillo

    PLAN A ANALIZAR:
    ${JSON.stringify(plan, null, 2)}

    FORMATO DE RESPUESTA:
    Si encuentras errores: Lista cada uno como "SECCIÓN-COMIDA-OPCIÓN: TIPO_ERROR - Descripción específica"
    Si no encuentras errores: Responde exactamente "SIN_ERRORES"

    Enfócate en los errores más críticos que afectan la usabilidad del plan.`
            }]
        });

        const analysisText = analysisResponse.choices[0]?.message?.content || '';
        
        if (analysisText.trim() === 'SIN_ERRORES') {
            return { hasErrors: false, errors: [] };
        }
        
        const errors = analysisText.split('\n').filter(line => line.trim().length > 0);
        return { hasErrors: errors.length > 0, errors };
    }

    private async correctPlanWithIA(plan: any, errors: string[], params: MealPlanParams): Promise<any> {
        // Si hay demasiados errores, mejor aplicar correcciones locales
        if (errors.length > 10) {
            console.log(`Demasiados errores (${errors.length}), aplicando correcciones locales...`);
            return this.applyLocalCorrections(plan, errors, params);
        }

        const correctionResponse = await this.openai.chat.completions.create({
            model: "gpt-4-turbo", 
            temperature: 0.05, // Reducir temperatura para mayor consistencia
            max_tokens: 3000,  // Reducir tokens para evitar JSON muy largo
            messages: [{
                role: "user",
                content: `Corrige ÚNICAMENTE los duplicados en este plan alimentario.

    ERRORES A CORREGIR:
    ${errors.slice(0, 5).join('\n')} // Solo los primeros 5 errores

    REGLAS SIMPLES:
    1. Si hay "espinaca" y "espinacas" → mantener solo "espinacas"
    2. Si hay "pollo" y "pechuga de pollo" → mantener solo "pechuga de pollo"  
    3. Si hay "pescado" y "filete de pescado" → mantener solo "filete de pescado"
    4. Eliminar ingredientes duplicados exactos

    PLAN (solo primeras 2 secciones para evitar JSON muy largo):
    ${JSON.stringify({Detox: plan.Detox, Mes1: plan.Mes1}, null, 1)}

    Responde SOLO con JSON válido sin markdown. Mantén estructura exacta.`
            }]
        });

        const correctedContent = correctionResponse.choices[0]?.message?.content || '';
        
        try {
            const cleanJson = extractJsonFromMarkdown(correctedContent);
            const partialCorrectedPlan = JSON.parse(cleanJson);
            
            // Combinar correcciones parciales con plan original
            const finalPlan = { ...plan };
            if (partialCorrectedPlan.Detox) finalPlan.Detox = partialCorrectedPlan.Detox;
            if (partialCorrectedPlan.Mes1) finalPlan.Mes1 = partialCorrectedPlan.Mes1;
            
            console.log('Plan parcialmente corregido por IA');
            return finalPlan;
            
        } catch (parseError) {
            console.error(`Error parseando plan corregido, aplicando correcciones locales...`);
            return this.applyLocalCorrections(plan, errors, params);
        }
    }


    private applyLocalCorrections(plan: any, errors: string[], params: MealPlanParams): any {
        const correctedPlan = JSON.parse(JSON.stringify(plan)); // Deep clone
        
        console.log('Aplicando correcciones locales para duplicados...');
        
        // Recorrer todas las secciones y aplicar correcciones simples
        for (const section of ['Detox', 'Mes1', 'Mes2']) {
            if (!correctedPlan[section]) continue;
            
            for (const mealTime of ['Desayuno', 'Comida', 'Colación', 'Cena']) {
                if (!correctedPlan[section][mealTime]) continue;
                
                for (let i = 1; i <= 3; i++) {
                    const meal = correctedPlan[section][mealTime][`Opcion ${i}`];
                    if (!meal || !meal.ingredientes) continue;
                    
                    // Aplicar correcciones simples de duplicados
                    meal.ingredientes = this.cleanIngredientsList(meal.ingredientes, meal.nombre);
                    meal.ingredientes = this.removeDuplicateIngredients(meal.ingredientes);
                }
            }
        }
        
        console.log('Correcciones locales aplicadas exitosamente');
        return correctedPlan;
    }

    private areIngredientsSimilar(ingredient1: string, ingredient2: string): boolean {
        const synonyms: {[key: string]: string[]} = {
            'pollo': ['pechuga de pollo', 'muslos de pollo', 'pollo', 'pollo deshebrado'],
            'res': ['carne de res', 'bistec', 'filete de res', 'bistec de res', 'carne de res molida'],
            'pescado': ['filete de pescado', 'salmón', 'atún', 'tilapia', 'pescado'],
            'lechuga': ['lechuga romana', 'lechuga mixta', 'lechuga orejona', 'lechuga'],
            'ajo': ['ajo', 'ajo picado', 'dientes de ajo'],
            'crema': ['crema', 'crema natural', 'crema fresca'],
            'espinacas': ['espinacas', 'espinaca', 'hojas de espinaca'],
            'pimientos': ['pimientos', 'pimiento', 'pimiento rojo', 'pimiento verde'],
            'jitomate': ['jitomate', 'tomate', 'jitomate cherry', 'tomate cherry'],
            'pepino': ['pepino', 'pepinos'],
            'requesón': ['requesón', 'queso requesón'],
            'nopal': ['nopal', 'nopales', 'nopal asado', 'nopales asados']
        };

        const ing1 = ingredient1.toLowerCase().trim();
        const ing2 = ingredient2.toLowerCase().trim();

        if (ing1.includes(ing2) || ing2.includes(ing1)) {
            return true;
        }

        for (const [base, variants] of Object.entries(synonyms)) {
            const ing1HasVariant = variants.some(v => ing1.includes(v)) || ing1.includes(base);
            const ing2HasVariant = variants.some(v => ing2.includes(v)) || ing2.includes(base);
            
            if (ing1HasVariant && ing2HasVariant) {
                return true;
            }
        }

        return false;
    }

    private validateNameIngredientCoherence(mealName: string, ingredientes: any[]): {
        isValid: boolean, 
        message: string, 
        missingIngredients: any[]
    } {
        if (!mealName) {
            return { isValid: true, message: '', missingIngredients: [] };
        }

        const missingIngredients: any[] = [];
        const ingredientNames = ingredientes.map(ing => ing.nombre?.toLowerCase() || '');
        const nameLower = mealName.toLowerCase();

        // Mapeo específico para casos problemáticos detectados
        const specificDishMappings: {[key: string]: {nombre: string, porcion: string}[]} = {
            'carne asada con crema de verduras y ensalada de espinaca': [
                {nombre: 'bistec de res', porcion: '150g'},
                {nombre: 'calabaza', porcion: '1/2 taza'},
                {nombre: 'crema natural', porcion: '2 cucharadas'},
                {nombre: 'espinacas', porcion: '1 taza'}
            ],
            'filete de pescado al mojo de ajo con ensalada fresca': [
                {nombre: 'filete de pescado', porcion: '120g'},
                {nombre: 'ajo', porcion: '2 dientes'},
                {nombre: 'lechuga romana', porcion: '1 taza'},
                {nombre: 'jitomate', porcion: '2 cucharadas'}
            ],
            'filete de pescado con ensalada fresca y aceite de oliva': [
                {nombre: 'filete de pescado', porcion: '120g'},
                {nombre: 'lechuga romana', porcion: '1 taza'},
                {nombre: 'jitomate', porcion: '2 cucharadas'},
                {nombre: 'aceite de oliva', porcion: '1 cucharadita'}
            ],
            'tostada de nopal con requesón y pepino': [
                {nombre: 'tostada integral', porcion: '1 pieza'},
                {nombre: 'nopal', porcion: '1 pieza'},
                {nombre: 'requesón', porcion: '50g'},
                {nombre: 'pepino', porcion: '1/4 pieza'}
            ],
            'alambre de pollo o res con pimiento y queso': [
                {nombre: 'pechuga de pollo', porcion: '150g'},
                {nombre: 'pimientos', porcion: '1/2 taza'},
                {nombre: 'cebolla', porcion: '1/4 pieza'},
                {nombre: 'queso panela', porcion: '50g'}
            ],
            'ensalada de pollo con aguacate, apio y semillas de calabaza': [
                {nombre: 'pechuga de pollo', porcion: '120g'},
                {nombre: 'aguacate', porcion: '1/2 pieza'},
                {nombre: 'apio', porcion: '2 tallos'},
                {nombre: 'semillas de calabaza', porcion: '1 cucharada'},
                {nombre: 'lechuga mixta', porcion: '1 taza'}
            ]
        };

        // Verificar mapeo específico primero
        if (specificDishMappings[nameLower]) {
            const requiredIngredients = specificDishMappings[nameLower];
            
            for (const required of requiredIngredients) {
                const hasIngredient = ingredientNames.some(name => 
                    this.areIngredientsSimilar(name, required.nombre.toLowerCase())
                );
                
                if (!hasIngredient) {
                    missingIngredients.push(required);
                }
            }
        } else {
            // Mapeo genérico para otros casos
            const keywordMap: {[key: string]: {nombre: string, porcion: string}[]} = {
                'pollo': [{nombre: 'pechuga de pollo', porcion: '120g'}],
                'res': [{nombre: 'bistec de res', porcion: '120g'}],
                'pescado': [{nombre: 'filete de pescado', porcion: '120g'}],
                'ajo': [{nombre: 'ajo', porcion: '2 dientes'}],
                'mojo de ajo': [{nombre: 'ajo', porcion: '3 dientes'}],
                'enchiladas': [{nombre: 'tortillas de maíz', porcion: '3 piezas'}],
                'tostada': [{nombre: 'tostada integral', porcion: '1 pieza'}],
                'ensalada': [{nombre: 'lechuga romana', porcion: '1 taza'}],
                'espinaca': [{nombre: 'espinacas', porcion: '1 taza'}],
                'espinacas': [{nombre: 'espinacas', porcion: '1 taza'}],
                'pimientos': [{nombre: 'pimientos', porcion: '1/2 taza'}],
                'pimiento': [{nombre: 'pimientos', porcion: '1/2 taza'}],
                'jitomate': [{nombre: 'jitomate', porcion: '2 cucharadas'}],
                'crema': [{nombre: 'crema natural', porcion: '2 cucharadas'}],
                'requesón': [{nombre: 'requesón', porcion: '50g'}],
                'nopal': [{nombre: 'nopal', porcion: '1 pieza'}],
                'aguacate': [{nombre: 'aguacate', porcion: '1/2 pieza'}],
                'apio': [{nombre: 'apio', porcion: '2 tallos'}],
                'verduras': [
                    {nombre: 'calabaza', porcion: '1/2 taza'},
                    {nombre: 'zanahoria', porcion: '1/4 pieza'}
                ]
            };

            for (const [keyword, requiredIngredients] of Object.entries(keywordMap)) {
                if (nameLower.includes(keyword)) {
                    for (const required of requiredIngredients) {
                        const hasIngredient = ingredientNames.some(name => 
                            this.areIngredientsSimilar(name, required.nombre.toLowerCase())
                        );
                        
                        if (!hasIngredient) {
                            missingIngredients.push(required);
                        }
                    }
                }
            }
        }

        const isValid = missingIngredients.length === 0;
        const message = isValid ? '' : `Faltan ingredientes del nombre: ${missingIngredients.map(i => i.nombre).join(', ')}`;

        return { isValid, message, missingIngredients };
    }

    private standardizePortionUnits(ingredientes: any[]): any[] {
        return ingredientes.map(ingredient => {
            if (!ingredient.nombre || !ingredient.porcion) return ingredient;

            const nombre = ingredient.nombre.toLowerCase();
            let porcion = ingredient.porcion.toString();

            // Reglas genéricas de homologación
            const homologationRules = [
                {
                    condition: (name: string) => name.includes('huevo') || name.includes('claras'),
                    replacements: [
                        {from: /unidad(es)?/gi, to: 'piezas'},
                        {from: /\bunidad\b/gi, to: 'pieza'},
                        {from: /\bunidades\b/gi, to: 'piezas'}
                    ]
                },
                {
                    condition: (name: string) => name.includes('carne') || name.includes('pollo') || 
                                            name.includes('pescado') || name.includes('res') || 
                                            name.includes('bistec') || name.includes('salmón') ||
                                            name.includes('pavo') || name.includes('filete'),
                    replacements: [
                        {from: /gramos/gi, to: 'g'}
                    ]
                },
                {
                    condition: (name: string) => ['jitomate', 'cebolla', 'aguacate', 'limón', 'nopal', 
                                                'calabaza', 'pepino', 'pimiento', 'brócoli'].some(v => name.includes(v)),
                    replacements: [
                        {from: /unidad(es)?/gi, to: 'pieza'},
                        {from: /\bunidades\b/gi, to: 'piezas'},
                        {from: /el jugo de 1 unidad/gi, to: '1/2 pieza'}
                    ]
                }
            ];

            for (const rule of homologationRules) {
                if (rule.condition(nombre)) {
                    for (const replacement of rule.replacements) {
                        porcion = porcion.replace(replacement.from, replacement.to);
                    }
                }
            }

            return { ...ingredient, porcion };
        });
    }

    private updatePreparation(currentPreparation: string, ingredientes: any[]): string {
        if (currentPreparation.length < 50) {
            const ingredientNames = ingredientes.map(ing => ing.nombre).join(', ');
            return `Preparar utilizando ${ingredientNames}. ${currentPreparation}`;
        }
        return currentPreparation;
    }

    private removeDuplicateIngredients(ingredientes: any[]): any[] {
        const seen = new Set<string>();
        const filtered: any[] = [];
        
        for (const ingredient of ingredientes) {
            if (!ingredient.nombre) continue;
            
            const normalizedName = ingredient.nombre.toLowerCase().trim();
            
            // Normalizar plurales comunes
            const baseName = normalizedName
                .replace(/s$/, '')  // quitar 's' final
                .replace(/es$/, '') // quitar 'es' final  
                .replace(/as$/, ''); // quitar 'as' final
            
            // Verificar duplicados exactos
            if (seen.has(normalizedName) || seen.has(baseName)) {
                console.log(`  🗑️ Eliminando duplicado exacto: ${ingredient.nombre}`);
                continue;
            }
            
            // Verificar duplicados de proteínas específicas
            let isDuplicate = false;
            for (const existingIngredient of filtered) {
                const existingName = existingIngredient.nombre.toLowerCase();
                
                // Casos específicos de duplicados
                if ((normalizedName.includes('pavo') && existingName.includes('pavo')) ||
                    (normalizedName.includes('res') && existingName.includes('res')) ||
                    (normalizedName.includes('pollo') && existingName.includes('pollo')) ||
                    (normalizedName.includes('pescado') && existingName.includes('pescado'))) {
                    
                    console.log(`  🔄 Detectado duplicado de proteína: ${existingIngredient.nombre} vs ${ingredient.nombre}`);
                    
                    // Mantener el más específico (mayor longitud normalmente)
                    if (ingredient.nombre.length > existingIngredient.nombre.length) {
                        console.log(`  ✅ Manteniendo el más específico: ${ingredient.nombre}`);
                        filtered.splice(filtered.indexOf(existingIngredient), 1);
                        break;
                    } else {
                        console.log(`  ✅ Manteniendo el existente: ${existingIngredient.nombre}`);
                        isDuplicate = true;
                        break;
                    }
                }
            }
            
            if (!isDuplicate) {
                seen.add(normalizedName);
                seen.add(baseName);
                filtered.push(ingredient);
            }
        }
        
        return filtered;
    }

    private async validateSectionWithNutritionRules(
        sectionData: any,
        section: string, 
        params: MealPlanParams,
        attempts: number,
        maxAttempts: number
    ): Promise<{cleanedData: any, issues: string[], warnings: string[]}> {
        
        const issues: string[] = [];
        const warnings: string[] = [];
        const cleanedData = { ...sectionData };

        const mealTimes = ['Desayuno', 'Comida', 'Colación', 'Cena'];

        for (const mealTime of mealTimes) {
            if (!cleanedData[mealTime]) continue;

            for (let i = 1; i <= 3; i++) {
                const optionKey = `Opcion ${i}`;
                const meal = cleanedData[mealTime][optionKey];
                
                if (!meal || !meal.ingredientes || !Array.isArray(meal.ingredientes)) {
                    continue;
                }

                // VALIDACIÓN 1: Coherencia nombre-ingredientes
                const coherenceResult = this.validateNameIngredientCoherence(meal.nombre, meal.ingredientes);
                if (!coherenceResult.isValid) {
                    warnings.push(`${section}-${mealTime}-${optionKey}: ${coherenceResult.message}`);
                    // Agregar ingredientes faltantes
                    meal.ingredientes = [...meal.ingredientes, ...coherenceResult.missingIngredients];
                }

                // VALIDACIÓN 2: Homologación de porciones
                meal.ingredientes = this.standardizePortionUnits(meal.ingredientes);

                // VALIDACIÓN 3: Eliminar duplicados
                meal.ingredientes = this.removeDuplicateIngredients(meal.ingredientes);

                // VALIDACIÓN 4: Aplicar reglas nutricionales específicas
                const nutritionValidation = validateMealAgainstRules(
                    meal.nombre,
                    meal.ingredientes,
                    mealTime,
                    params.tipo_dieta,
                    params.objetivo,
                    params.alimentos_evitar || []
                );

                if (!nutritionValidation.isValid) {
                    warnings.push(`${section}-${mealTime}-${optionKey}: ${nutritionValidation.violations.join(', ')}`);
                    
                    if (nutritionValidation.correctedIngredients) {
                        meal.ingredientes = nutritionValidation.correctedIngredients;
                    }
                }

                // VALIDACIÓN 5: Actualizar preparación si es necesaria
                if (coherenceResult.missingIngredients.length > 0) {
                    meal.preparacion = this.updatePreparation(meal.preparacion, meal.ingredientes);
                }
            }
        }

        console.log(`✅ Validación completada para ${section}`);
        if (warnings.length > 0) {
            console.log(`⚠️ Correcciones aplicadas:`, warnings.slice(0, 3));
        }

        return { cleanedData, issues, warnings };
    }

    // FUNCIÓN PRINCIPAL CORREGIDA
    async generateCompletePlan(params: MealPlanParams): Promise<any> {
        const sections = ["Detox", "Mes1", "Mes2"];
        const completePlan: any = {};
        const globalUsedMeals: string[] = [];

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            
            // Delay entre secciones
            if (i > 0) {
                console.log(`Esperando 8 segundos antes de generar ${section}...`);
                await new Promise(resolve => setTimeout(resolve, 8000));
            }

            let sectionPlan = null;
            let attempts = 0;
            const maxAttempts = 3;

            console.log(`Generando sección: ${section}`);

            while (!sectionPlan && attempts < maxAttempts) {
                attempts++;
                console.log(`Intento ${attempts} para ${section}`);

                try {
                    // Delay entre intentos
                    if (attempts > 1) {
                        const waitTime = attempts * 3000;
                        console.log(`Esperando ${waitTime/1000} segundos antes del intento ${attempts}...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }

                    // Obtener comidas disponibles EXCLUYENDO las ya usadas
                    const exactMealNames = await this.getAvailableExactNames(
                        params.tipo_dieta, 
                        params.objetivo, 
                        globalUsedMeals, // EXCLUIR las ya usadas globalmente
                        false // NO permitir reutilización
                    );

                    console.log(`Comidas disponibles para ${section} (intento ${attempts}):`, {
                        Desayuno: exactMealNames.Desayuno?.length || 0,
                        Comida: exactMealNames.Comida?.length || 0,
                        Colación: exactMealNames.Colación?.length || 0,
                        Cena: exactMealNames.Cena?.length || 0
                    });

                    // Verificar si tenemos suficientes comidas
                    const totalAvailable = Object.values(exactMealNames).reduce((sum: number, meals: any) => sum + (meals?.length || 0), 0);
                    
                    if (totalAvailable < 8 && attempts === 1) {
                        console.log(`Pocas comidas disponibles (${totalAvailable}), permitiendo reutilización desde intento 1...`);
                        const exactMealNamesWithReuse = await this.getAvailableExactNames(
                            params.tipo_dieta, 
                            params.objetivo, 
                            [], // Sin exclusiones
                            true // Permitir reutilización
                        );
                        
                        const generatedContent = await this.generateSectionWithRateLimit(section, params, exactMealNamesWithReuse, globalUsedMeals, attempts);
                        sectionPlan = await this.processGeneratedContent(generatedContent, section, exactMealNamesWithReuse, globalUsedMeals, attempts, maxAttempts, params);
                        
                        if (sectionPlan) break;
                    } else {
                        // Flujo normal con exclusiones
                        const generatedContent = await this.generateSectionWithRateLimit(section, params, exactMealNames, globalUsedMeals, attempts);
                        sectionPlan = await this.processGeneratedContent(generatedContent, section, exactMealNames, globalUsedMeals, attempts, maxAttempts, params);
                        
                        if (sectionPlan) break;
                    }

                } catch (error: any) {
                    console.error(`Error en intento ${attempts} para ${section}:`, error.message);
                    
                    if (error.message?.includes('rate_limit_exceeded') || error.message?.includes('429') || error.message?.includes('quota')) {
                        console.log(`Error de cuota/rate limit - usando plan de emergencia...`);
                        const emergencyMeals = await this.getAvailableExactNames(params.tipo_dieta, params.objetivo, [], true);
                        sectionPlan = this.generateEmergencyPlan(section, emergencyMeals, params);
                        break;
                    }
                    
                    if (attempts >= maxAttempts) {
                        console.log(`Error en último intento, generando plan de emergencia...`);
                        const emergencyMeals = await this.getAvailableExactNames(params.tipo_dieta, params.objetivo, [], true);
                        sectionPlan = this.generateEmergencyPlan(section, emergencyMeals, params);
                        break;
                    }
                }
            }

            // GARANTÍA FINAL
            if (!sectionPlan) {
                console.log(`GARANTÍA FINAL: Creando plan de emergencia para ${section}`);
                try {
                    const emergencyMeals = await this.getAvailableExactNames(params.tipo_dieta, params.objetivo, [], true);
                    sectionPlan = this.generateEmergencyPlan(section, emergencyMeals, params);
                } catch (emergencyError) {
                    console.log(`Error en plan de emergencia, usando plan genérico...`);
                    sectionPlan = this.generateGenericPlan(section, params);
                }
            }

            completePlan[section] = sectionPlan;
            
            // AGREGAR las comidas usadas al registro global
            const newMeals = extractMealNames(sectionPlan);
            globalUsedMeals.push(...newMeals);
            
            console.log(`Sección ${section} completada`);
            console.log(`Comidas agregadas: ${newMeals.join(', ')}`);
        }

        // Estadísticas finales
        const totalMealsUsed = globalUsedMeals.length;
        const uniqueMealsUsed = [...new Set(globalUsedMeals)].length;
        
        console.log(`Plan completo generado exitosamente`);
        console.log(`Estadísticas: ${totalMealsUsed} comidas total, ${uniqueMealsUsed} únicas`);

        // Análisis de plan post generación
        console.log(`🔍 Iniciando análisis y corrección post-generación...`);
        const finalPlan = await this.analyzeAndCorrectCompletePlan(completePlan, params);

        return {
            plan: finalPlan,
            statistics: {
                totalMealsGenerated: totalMealsUsed,
                uniqueMealsGenerated: uniqueMealsUsed,
                sectionsGenerated: sections.length,
                usedMeals: globalUsedMeals
            }
        };
    }

    private async processGeneratedContent(
        generatedContent: string,
        section: string,
        exactMealNames: any,
        usedMeals: string[],
        attempts: number,
        maxAttempts: number,
        params: MealPlanParams
    ): Promise<any> {
        if (!generatedContent) {
            console.log(`No se recibió contenido para ${section}`);
            return null;
        }

        // VALIDACIÓN 1: Ingredientes prohibidos en contenido crudo
        if (params.alimentos_evitar && params.alimentos_evitar.length > 0) {
            const validation = this.validateForbiddenIngredients(generatedContent, params.alimentos_evitar);
            if (!validation.isValid) {
                console.log(`🚫 Alimentos prohibidos detectados en ${section} (intento ${attempts}):`, validation.violations);
                
                if (attempts < maxAttempts) {
                    console.log(`❌ Rechazando por alimentos prohibidos, reintentando...`);
                    return null;
                } else {
                    console.log(`⚠️ Último intento con violaciones, generando plan de emergencia...`);
                    return this.generateEmergencyPlan(section, exactMealNames, params);
                }
            } else {
                console.log(`✅ Validación de alimentos prohibidos pasada para ${section}`);
            }
        }

        // VALIDACIÓN 2: Detectar markdown temprano (ACTUALIZADO)
        if (generatedContent.includes('```') && attempts < maxAttempts) {
            console.log(`Detectado markdown en respuesta de ${section}, reintentando...`);
            return null;
        }

        console.log(`Contenido generado para ${section} (primeros 200 chars):`, generatedContent.substring(0, 200) + '...');

        // VALIDACIÓN 3: Limpiar JSON (ACTUALIZADO - usar función propia)
        const cleanJson = extractJsonFromMarkdown(generatedContent);
        
        // Validación JSON básica
        if (!cleanJson.startsWith('{') || !cleanJson.endsWith('}')) {
            if (attempts >= maxAttempts) {
                console.log(`JSON malformado en último intento, usando plan de emergencia...`);
                return this.generateEmergencyPlan(section, exactMealNames, params);
            }
            console.log(`Contenido no es JSON válido para ${section}`);
            return null;
        }
        
        // VALIDACIÓN 4: Parsear JSON
        let parsedPlan;
        try {
            parsedPlan = JSON.parse(cleanJson);
            console.log(`JSON parseado correctamente para ${section}`);
        } catch (parseError: unknown) {
            if (attempts >= maxAttempts) {
                console.log(`Error de parsing en último intento, usando plan de emergencia...`);
                return this.generateEmergencyPlan(section, exactMealNames, params);
            }
            const errorMessage = parseError instanceof Error ? parseError.message : 'Error desconocido';
            console.log(`Error parseando JSON para ${section}:`, errorMessage);
            return null;
        }
        
        // VALIDACIÓN 5: Estructura básica
        const sectionData = parsedPlan[section] || parsedPlan;
        
        if (!sectionData || typeof sectionData !== 'object') {
            if (attempts >= maxAttempts) {
                console.log(`Estructura incorrecta en último intento, usando plan de emergencia...`);
                return this.generateEmergencyPlan(section, exactMealNames, params);
            }
            console.log(`Estructura incorrecta para ${section}:`, typeof sectionData);
            return null;
        }

        // VALIDACIÓN 6: Aplicar reglas nutricionales específicas (NUEVO SISTEMA GENÉRICO)
        try {
            const validationResult = await this.validateSectionWithUniversalRules(
                sectionData, 
                section, 
                params, 
                attempts, 
                maxAttempts
            );

            console.log(`${section} completado y validado con sistema genérico`);

            if (validationResult.warnings.length > 0) {
                console.log(`⚠️ Correcciones aplicadas:`, validationResult.warnings.slice(0, 3));
                if (validationResult.warnings.length > 3) {
                    console.log(`... y ${validationResult.warnings.length - 3} correcciones adicionales`);
                }
            }

            if (validationResult.issues.length > 0) {
                console.log(`ℹ️ Issues detectados:`, validationResult.issues.slice(0, 2));
            }

            return validationResult.cleanedData;

        } catch (validationError: unknown) {
            const errorMessage = validationError instanceof Error ? validationError.message : 'Error de validación desconocido';
            console.error(`Error en validación genérica para ${section}:`, errorMessage);
            
            if (attempts >= maxAttempts) {
                console.log(`Error de validación en último intento, usando plan de emergencia...`);
                return this.generateEmergencyPlan(section, exactMealNames, params);
            }
            
            // Si no es el último intento, permitir reintentar
            return null;
        }
    }

    private getCategoryOfIngredient(ingredient: string): string {
        const ingredientLower = ingredient.toLowerCase();
        
        const categories = {
            'protein_meat': ['res', 'bistec', 'carne', 'filete de res', 'carne molida'],
            'protein_poultry': ['pollo', 'pechuga', 'muslos', 'pavo'],
            'protein_fish': ['pescado', 'salmón', 'atún', 'tilapia', 'ceviche'],
            'protein_dairy': ['queso', 'requesón', 'yogurt', 'crema', 'leche'],
            'protein_eggs': ['huevo', 'huevos', 'claras'],
            'vegetables': ['lechuga', 'espinaca', 'calabaza', 'nopal', 'pepino', 'jitomate', 'cebolla', 'apio', 'brócoli', 'champiñones'],
            'fruits': ['moras', 'fresas', 'aguacate', 'limón', 'naranja'],
            'nuts_seeds': ['almendras', 'nueces', 'semillas', 'coco'],
            'grains_starches': ['tortilla', 'tostada', 'pan', 'harina', 'avena'],
            'seasonings': ['sal', 'pimienta', 'ajo', 'orégano', 'canela', 'chile'],
            'fats': ['aceite', 'mantequilla'],
            'generic_terms': ['ensalada fresca', 'verduras mixtas', 'salsa casera', 'ensalada verde']
        };
        
        for (const [category, items] of Object.entries(categories)) {
            if (items.some(item => ingredientLower.includes(item))) {
                return category;
            }
        }
        
        return 'unknown';
    }

    private extractRequiredIngredients(mealName: string): {ingredient: string, defaultPortion: string}[] {
        const required: {ingredient: string, defaultPortion: string}[] = [];
        
        const keywordMap = {
            // Proteínas
            'pollo': {ingredient: 'pechuga de pollo', defaultPortion: '120g'},
            'res': {ingredient: 'bistec de res', defaultPortion: '120g'},
            'pescado': {ingredient: 'filete de pescado', defaultPortion: '120g'},
            'pavo': {ingredient: 'pechuga de pavo', defaultPortion: '120g'},
            
            // Vegetales específicos
            'espinaca': {ingredient: 'espinacas', defaultPortion: '1 taza'},
            'espinacas': {ingredient: 'espinacas', defaultPortion: '1 taza'},
            'nopal': {ingredient: 'nopal', defaultPortion: '1 pieza'},
            'nopales': {ingredient: 'nopales', defaultPortion: '2 piezas'},
            'calabaza': {ingredient: 'calabaza', defaultPortion: '1/2 taza'},
            'brócoli': {ingredient: 'brócoli', defaultPortion: '1 taza'},
            'champiñones': {ingredient: 'champiñones', defaultPortion: '100g'},
            
            // Condimentos críticos
            'ajo': {ingredient: 'ajo', defaultPortion: '2 dientes'},
            'mojo de ajo': {ingredient: 'ajo', defaultPortion: '3 dientes'},
            
            // Frutas específicas
            'aguacate': {ingredient: 'aguacate', defaultPortion: '1/2 pieza'},
            'moras': {ingredient: 'moras', defaultPortion: '1 taza'},
            'fresas': {ingredient: 'fresas', defaultPortion: '100g'},
            
            // Lácteos específicos
            'requesón': {ingredient: 'requesón', defaultPortion: '50g'},
            'queso panela': {ingredient: 'queso panela', defaultPortion: '50g'},
            
            // Base de ensaladas
            'ensalada': {ingredient: 'lechuga romana', defaultPortion: '1 taza'}
        };

        for (const [keyword, config] of Object.entries(keywordMap)) {
            if (mealName.includes(keyword)) {
                required.push(config);
            }
        }

        return required;
    }

    private isIngredientRelatedToMeal(
        ingredientName: string, 
        mealName: string,
        allIngredients: string[] = []
    ): boolean {
        const ingredient = ingredientName.toLowerCase();
        const meal = mealName.toLowerCase();
        
        // REGLA CRÍTICA 0: Detectar "bistec de res" fantasma (120g específicamente)
        if ((ingredient === 'bistec de res' || ingredient === 'bistec') && 
            !meal.includes('bistec') && 
            !meal.includes('carne asada') &&
            !meal.includes('res encebollado') &&
            !meal.includes('alambre') &&
            !meal.includes('fajitas de res')) {
            console.log(`  🚫 CRÍTICO: Eliminando bistec fantasma de "${meal}"`);
            return false;
        }

        // REGLA CRÍTICA 0.5: No mezclar tipos de carne en el mismo platillo
        if (ingredient.includes('bistec') || ingredient === 'carne de res') {
            const hasPork = allIngredients.some(ing => ing.includes('cerdo') || ing.includes('chuleta'));
            const hasFish = allIngredients.some(ing => ing.includes('pescado'));
            const hasMolida = allIngredients.some(ing => ing.includes('molida') || ing.includes('albóndigas'));
            const hasChicken = allIngredients.some(ing => ing.includes('pollo'));
            const hasDeshebrada = allIngredients.some(ing => ing.includes('deshebrada'));
            
            if (hasPork || hasFish || hasMolida || (hasChicken && !meal.includes('o res')) || hasDeshebrada) {
                console.log(`  🚫 Bistec incompatible con otras proteínas en "${meal}"`);
                return false;
            }
        }
        
        // REGLA CRÍTICA 1: Ensaladas específicas no deben tener proteínas cárnicas no mencionadas
        if (meal.includes('ensalada') && 
            !meal.includes('pollo') && 
            !meal.includes('pavo') && 
            !meal.includes('res') && 
            !meal.includes('pescado') &&
            !meal.includes('carne') &&
            !meal.includes('cerdo') &&
            !meal.includes('deshebrada')) {
            
            const unwantedProteins = ['bistec', 'res', 'pollo', 'pavo', 'pescado', 'carne', 'filete', 'pechuga', 'cerdo', 'chuleta'];
            if (unwantedProteins.some(protein => ingredient.includes(protein))) {
                console.log(`  🚫 Eliminando ${ingredient} de ensalada sin proteína mencionada`);
                return false;
            }
        }
        
        // REGLA CRÍTICA 2: Platillos de pescado no deben tener otras carnes
        if (meal.includes('pescado') || meal.includes('filete de pescado') || meal.includes('ceviche')) {
            const otherMeats = ['bistec', 'res', 'pollo', 'pavo', 'carne', 'cerdo'];
            if (otherMeats.some(meat => ingredient.includes(meat))) {
                console.log(`  🚫 Eliminando ${ingredient} de platillo de pescado`);
                return false;
            }
        }
        
        // REGLA CRÍTICA 3: Platillos de pollo específico no deben tener otras carnes
        if ((meal.includes('pollo') || meal.includes('pechuga')) && 
            !meal.includes('o res') && 
            !meal.includes('o pavo')) {
            
            const otherMeats = ['bistec', 'res', 'pavo', 'pescado', 'carne molida', 'filete', 'cerdo'];
            if (otherMeats.some(meat => ingredient.includes(meat))) {
                console.log(`  🚫 Eliminando ${ingredient} de platillo específico de pollo`);
                return false;
            }
        }
        
        // REGLA CRÍTICA 4: Platillos específicos de una carne no deben tener múltiples proteínas
        if (meal.includes('bistec') || meal.includes('carne asada')) {
            const otherProteins = ['pollo', 'pavo', 'pescado', 'filete de pescado', 'cerdo'];
            if (otherProteins.some(protein => ingredient.includes(protein))) {
                console.log(`  🚫 Eliminando ${ingredient} de platillo específico de res`);
                return false;
            }
        }

        // REGLA CRÍTICA 4.5: Platillos de cerdo no deben tener otras carnes
        if (meal.includes('cerdo') || meal.includes('chuleta')) {
            const otherProteins = ['pollo', 'pavo', 'pescado', 'bistec', 'res'];
            if (otherProteins.some(protein => ingredient.includes(protein))) {
                console.log(`  🚫 Eliminando ${ingredient} de platillo de cerdo`);
                return false;
            }
        }
        
        // REGLA CRÍTICA 5: Alambre con "o" debe elegir solo una proteína
        if (meal.includes('alambre') && meal.includes(' o ')) {
            const hasPollo = allIngredients.some(ing => ing.includes('pollo'));
            const hasRes = allIngredients.some(ing => ing.includes('res') || ing.includes('bistec'));
            
            if (hasPollo && (ingredient.includes('res') || ingredient.includes('bistec'))) {
                console.log(`  🚫 Alambre ya tiene pollo, eliminando ${ingredient}`);
                return false;
            }
            if (hasRes && ingredient.includes('pollo')) {
                console.log(`  🚫 Alambre ya tiene res, eliminando ${ingredient}`);
                return false;
            }
        }

        // REGLA CRÍTICA 6: Albóndigas solo deben tener carne molida, no bistec
        if (meal.includes('albóndigas') || meal.includes('albondiga')) {
            if (ingredient.includes('bistec') && !ingredient.includes('molida')) {
                console.log(`  🚫 Eliminando bistec de platillo de albóndigas (debe ser carne molida)`);
                return false;
            }
        }
        
        // REGLAS GENÉRICAS
        const incompatibilityRules = [
            {
                condition: () => ['moras', 'fresas', 'chocolate', 'coco', 'almendras tostadas', 'jícama'].some(sweet => meal.includes(sweet)),
                prohibited: ['bistec', 'res', 'pollo', 'pescado', 'carne', 'filete', 'pavo', 'cerdo']
            },
            {
                condition: () => meal.includes('almendras tostadas') && !meal.includes('tostada'),
                prohibited: ['tostada', 'pan', 'tortilla']
            },
            {
                condition: () => meal.includes('ensalada') && !meal.includes('griega'),
                prohibited: ['ensalada fresca', 'ensalada verde']
            }
        ];

        for (const rule of incompatibilityRules) {
            if (rule.condition()) {
                if (rule.prohibited.some(prohibited => ingredient.includes(prohibited))) {
                    console.log(`  🚫 Regla genérica: eliminando ${ingredient} de "${meal}"`);
                    return false;
                }
            }
        }

        return true;
    }

    private cleanIngredientsList(ingredientes: any[], mealName: string): any[] {
        if (!ingredientes || !Array.isArray(ingredientes)) return [];

        console.log(`🧹 Limpiando ingredientes de: "${mealName}"`);
        console.log(`   Total ANTES: ${ingredientes.length} ingredientes`);

        // PASO 1: Eliminar duplicados EXACTOS y SIMILARES
        const seen = new Set<string>();
        const deduplicatedIngredients: any[] = [];
        
        for (const ingredient of ingredientes) {
            if (!ingredient.nombre) continue;
            
            const normalizedName = ingredient.nombre.toLowerCase().trim();
            
            // Duplicado exacto
            if (seen.has(normalizedName)) {
                console.log(`  🧹 Eliminado duplicado exacto: "${normalizedName}"`);
                continue;
            }
            
            // Duplicado similar (espinaca/espinacas, lechuga/lechuga romana)
            const hasSimilar = Array.from(seen).some(existing => {
                if ((existing.includes(normalizedName) || normalizedName.includes(existing)) && 
                    Math.abs(existing.length - normalizedName.length) <= 8) {
                    console.log(`  🧹 Eliminado duplicado similar: "${normalizedName}" (ya existe "${existing}")`);
                    return true;
                }
                return false;
            });
            
            if (hasSimilar) continue;
            
            seen.add(normalizedName);
            deduplicatedIngredients.push(ingredient);
        }

        // PASO 2: Eliminar patrones de duplicados conocidos
        let cleanedFromPatterns = [...deduplicatedIngredients];
        
        const duplicatePatterns = [
            ['espinaca', 'espinacas'],
            ['lechuga', 'lechuga romana'],
            ['nopal', 'nopales'],
            ['bistec', 'bistec de res']
        ];

        for (const [singular, plural] of duplicatePatterns) {
            const hasSingular = cleanedFromPatterns.some(ing => 
                ing.nombre.toLowerCase() === singular
            );
            const hasPlural = cleanedFromPatterns.some(ing => 
                ing.nombre.toLowerCase().includes(plural)
            );
            
            if (hasSingular && hasPlural) {
                cleanedFromPatterns = cleanedFromPatterns.filter(ing => 
                    ing.nombre.toLowerCase() !== singular
                );
                console.log(`  🧹 Eliminado patrón duplicado: "${singular}" (manteniendo "${plural}")`);
            }
        }

        // PASO 3: Remover ingredientes no relacionados con contexto completo
        const allIngredientNames = cleanedFromPatterns.map(i => i.nombre.toLowerCase());
        const finalCleanedIngredients = cleanedFromPatterns.filter(ingredient => {
            return this.isIngredientRelatedToMeal(
                ingredient.nombre, 
                mealName,
                allIngredientNames
            );
        });

        console.log(`   Total DESPUÉS: ${finalCleanedIngredients.length} ingredientes`);
        
        if (ingredientes.length !== finalCleanedIngredients.length) {
            console.log(`   ✅ Limpiados: ${ingredientes.length - finalCleanedIngredients.length} ingredientes eliminados`);
        }

        return finalCleanedIngredients;
    }

    private validateIngredientCoherenceByCategory(mealName: string, ingredientes: any[]): {
        isValid: boolean,
        issues: string[],
        suggestions: any[]
    } {
        const issues: string[] = [];
        const suggestions: any[] = [];
        const nameLower = mealName.toLowerCase();
        const ingredientCategories = ingredientes.map(ing => ({
            name: ing.nombre,
            category: this.getCategoryOfIngredient(ing.nombre),
            original: ing
        }));

        // Regla 1: Detectar incompatibilidades categóricas obvias
        const hasSweets = nameLower.includes('moras') || nameLower.includes('fresas') || 
                        nameLower.includes('chocolate') || nameLower.includes('coco');
        const hasProteinMeat = ingredientCategories.some(ing => 
            ing.category === 'protein_meat' || ing.category === 'protein_poultry' || ing.category === 'protein_fish'
        );
        
        if (hasSweets && hasProteinMeat) {
            issues.push('Incompatibilidad: platillo dulce con proteínas cárnicas');
        }

        // Regla 2: Validar que ingredientes principales del nombre estén presentes
        const requiredIngredients = this.extractRequiredIngredients(nameLower);
        for (const required of requiredIngredients) {
            const hasRequired = ingredientCategories.some(ing => 
                ing.name.toLowerCase().includes(required.ingredient)
            );
            
            if (!hasRequired) {
                issues.push(`Falta ingrediente principal: ${required.ingredient}`);
                suggestions.push({
                    nombre: required.ingredient,
                    porcion: required.defaultPortion
                });
            }
        }

        // Regla 3: Detectar términos genéricos excesivos
        const genericCount = ingredientCategories.filter(ing => ing.category === 'generic_terms').length;
        if (genericCount > 0) {
            issues.push(`Términos genéricos detectados: ${genericCount} ingrediente(s)`);
        }

        return {
            isValid: issues.length === 0,
            issues,
            suggestions
        };
    }

    private async validateSectionWithUniversalRules(
        sectionData: any,
        section: string, 
        params: MealPlanParams,
        attempts: number,
        maxAttempts: number
    ): Promise<{cleanedData: any, issues: string[], warnings: string[]}> {
        
        const issues: string[] = [];
        const warnings: string[] = [];
        const cleanedData = { ...sectionData };
        const mealTimes = ['Desayuno', 'Comida', 'Colación', 'Cena'];
        let criticalErrorsCount = 0;

        for (const mealTime of mealTimes) {
            if (!cleanedData[mealTime]) continue;

            for (let i = 1; i <= 3; i++) {
                const optionKey = `Opcion ${i}`;
               const meal: {
                    nombre: string;
                    ingredientes: Array<{nombre: string; porcion: string}>;
                    preparacion: string;
                } = cleanedData[mealTime][optionKey];
                
                if (!meal || !meal.ingredientes || !Array.isArray(meal.ingredientes)) {
                    continue;
                }

                console.log(`\n🔍 Validando ${section}-${mealTime}-${optionKey}: "${meal.nombre}"`);

                // VALIDACIÓN 1: Ingredientes faltantes del nombre
                const missingValidation = this.validateMissingIngredientsFromName(
                    meal.nombre, 
                    meal.ingredientes
                );
                
                if (!missingValidation.isValid) {
                    criticalErrorsCount++;
                    warnings.push(`${section}-${mealTime}-${optionKey}: ${missingValidation.errors.join(', ')}`);
                    console.log(`  ⚠️ Faltan ingredientes: ${missingValidation.errors.join(', ')}`);
                    
                    if (missingValidation.corrections.length > 0) {
                        meal.ingredientes = [...meal.ingredientes, ...missingValidation.corrections];
                        console.log(`  ➕ Agregados: ${missingValidation.corrections.map(c => c.nombre).join(', ')}`);
                    }
                }

                // VALIDACIÓN 2: Limpiar ingredientes (CRÍTICA)
                const originalCount = meal.ingredientes.length;
                meal.ingredientes = this.cleanIngredientsList(meal.ingredientes, meal.nombre);
                
                if (originalCount !== meal.ingredientes.length) {
                    const diff = originalCount - meal.ingredientes.length;
                    warnings.push(`${section}-${mealTime}-${optionKey}: ${diff} ingredientes eliminados`);
                    console.log(`  ✅ Limpieza: ${originalCount} → ${meal.ingredientes.length}`);
                }

                // VALIDACIÓN 2.5: Verificación post-limpieza de errores críticos
                const ingredientNames = meal.ingredientes.map(i => i.nombre.toLowerCase());
                const nameLower = meal.nombre.toLowerCase();
                
                // Detectar bistec en snacks dulces
                const isSweetSnack = ['fresa', 'mora', 'chocolate', 'coco'].some(s => nameLower.includes(s));
                const hasBistec = ingredientNames.some(i => i.includes('bistec'));
                
                if (isSweetSnack && hasBistec) {
                    console.log(`  ⚠️⚠️⚠️ ERROR CRÍTICO: Bistec en snack dulce, eliminando...`);
                    meal.ingredientes = meal.ingredientes.filter(i => !i.nombre.toLowerCase().includes('bistec'));
                    criticalErrorsCount++;
                }

                // Detectar duplicados que quedaron
                for (let j = 0; j < ingredientNames.length; j++) {
                    for (let k = j + 1; k < ingredientNames.length; k++) {
                        const name1 = ingredientNames[j];
                        const name2 = ingredientNames[k];
                        
                        if (name1.includes(name2) || name2.includes(name1)) {
                            console.log(`  ⚠️⚠️⚠️ DUPLICADO RESTANTE: "${name1}" y "${name2}"`);
                            // Eliminar el más corto
                            meal.ingredientes = meal.ingredientes.filter((_, idx) => 
                                idx !== (name1.length < name2.length ? j : k)
                            );
                            criticalErrorsCount++;
                            break;
                        }
                    }
                }

                // VALIDACIÓN 3: Coherencia por categorías
                const coherenceResult = this.validateIngredientCoherenceByCategory(
                    meal.nombre, 
                    meal.ingredientes
                );
                
                if (!coherenceResult.isValid) {
                    warnings.push(`${section}-${mealTime}-${optionKey}: ${coherenceResult.issues.join(', ')}`);
                    
                    if (coherenceResult.suggestions.length > 0) {
                        meal.ingredientes = [...meal.ingredientes, ...coherenceResult.suggestions];
                        console.log(`  ➕ Sugerencias agregadas: ${coherenceResult.suggestions.map(s => s.nombre).join(', ')}`);
                        
                        // LIMPIAR NUEVAMENTE después de agregar sugerencias
                        meal.ingredientes = this.cleanIngredientsList(meal.ingredientes, meal.nombre);
                        console.log(`  🧹 Re-limpieza post-sugerencias`);
                    }

                }

                // VALIDACIÓN 4: Homologación
                meal.ingredientes = this.standardizePortionUnits(meal.ingredientes);

                // VALIDACIÓN 5: Reglas nutricionales
                const nutritionValidation = validateMealAgainstRules(
                    meal.nombre,
                    meal.ingredientes,
                    mealTime,
                    params.tipo_dieta,
                    params.objetivo,
                    params.alimentos_evitar || []
                );

                if (!nutritionValidation.isValid) {
                    warnings.push(`${section}-${mealTime}-${optionKey}: ${nutritionValidation.violations.join(', ')}`);
                    
                    if (nutritionValidation.correctedIngredients) {
                        meal.ingredientes = nutritionValidation.correctedIngredients;
                        console.log(`  ⚖️ Reglas nutricionales aplicadas`);
                    }
                }

                console.log(`  ✅ ${meal.nombre} - Validación completa`);
            }
        }

        // Rechazar si hay muchos errores críticos
        if (criticalErrorsCount > 5 && attempts < maxAttempts) {
            console.log(`\n❌ Demasiados errores críticos (${criticalErrorsCount}), reintentando...`);
            throw new Error('Demasiados errores de coherencia');
        }

        console.log(`\n📋 Validación ${section} completada: ${warnings.length} correcciones`);
        return { cleanedData, issues, warnings };
    }

    private validateMissingIngredientsFromName(mealName: string, ingredientes: any[]): {
    isValid: boolean;
    errors: string[];
    corrections: any[];
    } {
        const errors: string[] = [];
        const corrections: any[] = [];
        
        if (!mealName || !ingredientes) {
            return { isValid: true, errors, corrections };
        }

        const nameLower = mealName.toLowerCase();
        const ingredientNames = ingredientes.map(i => i.nombre.toLowerCase());

        const keywordMap: {[key: string]: {ingredients: string[], defaultPortion: string}} = {
            'fresa': { ingredients: ['fresa', 'fresas'], defaultPortion: '100g' },
            'mora': { ingredients: ['mora', 'moras'], defaultPortion: '100g' },
            'aguacate': { ingredients: ['aguacate'], defaultPortion: '1/2 pieza' },
            'bistec': { ingredients: ['bistec de res', 'bistec'], defaultPortion: '150g' },
            'pollo': { ingredients: ['pechuga de pollo', 'pollo'], defaultPortion: '150g' },
            'pescado': { ingredients: ['filete de pescado', 'pescado'], defaultPortion: '150g' },
            'pavo': { ingredients: ['pechuga de pavo', 'pavo'], defaultPortion: '150g' },
            'ajo': { ingredients: ['ajo', 'diente de ajo'], defaultPortion: '2 dientes' },
            'cebolla': { ingredients: ['cebolla'], defaultPortion: '1/2 pieza' },
            'espinaca': { ingredients: ['espinaca', 'espinacas'], defaultPortion: '1 taza' },
            'queso fresco': { ingredients: ['queso fresco'], defaultPortion: '50g' },
            'queso panela': { ingredients: ['queso panela'], defaultPortion: '50g' },
            'queso feta': { ingredients: ['queso feta'], defaultPortion: '50g' },
            'queso oaxaca': { ingredients: ['queso oaxaca'], defaultPortion: '50g' },
            'encebollado': { ingredients: ['cebolla'], defaultPortion: '1/2 pieza' },
            'mojo de ajo': { ingredients: ['ajo'], defaultPortion: '3 dientes' },
        };

        for (const [keyword, config] of Object.entries(keywordMap)) {
            if (nameLower.includes(keyword)) {
                const hasIngredient = config.ingredients.some(expected => 
                    ingredientNames.some(ing => ing.includes(expected))
                );
                
                if (!hasIngredient) {
                    errors.push(`Falta ingrediente principal: ${config.ingredients[0]}`);
                    corrections.push({
                        nombre: config.ingredients[0],
                        porcion: config.defaultPortion
                    });
                }
            }
        }

        // Validaciones especiales para líquidos
        if ((nameLower.includes('caldo') || nameLower.includes('sopa')) && 
            !ingredientNames.some(ing => ing.includes('caldo') || ing.includes('agua'))) {
            errors.push('Falta líquido base en caldo/sopa');
            corrections.push({ nombre: 'caldo de pollo', porcion: '500ml' });
        }

        if (nameLower.includes('crema de') && 
            !ingredientNames.some(ing => ing.includes('leche') || ing.includes('crema'))) {
            errors.push('Falta líquido base en crema');
            corrections.push({ nombre: 'leche', porcion: '200ml' });
        }

        return { isValid: errors.length === 0, errors, corrections };
    }

    // NUEVA FUNCIÓN 2: Validación simple de estructura del plan
    private validateCompletePlanStructure(plan: any): {hasIssues: boolean, issues: string[]} {
        const issues: string[] = [];
        const sections = ['Detox', 'Mes1', 'Mes2'];
        const mealTimes = ['Desayuno', 'Comida', 'Colación', 'Cena'];
        
        for (const section of sections) {
            if (!plan[section]) {
                issues.push(`Falta sección: ${section}`);
                continue;
            }
            
            for (const mealTime of mealTimes) {
                if (!plan[section][mealTime]) {
                    issues.push(`Falta ${section}-${mealTime}`);
                    continue;
                }
                
                for (let i = 1; i <= 3; i++) {
                    const option = plan[section][mealTime][`Opcion ${i}`];
                    if (!option) {
                        issues.push(`Falta ${section}-${mealTime}-Opcion ${i}`);
                    } else if (!option.nombre || !option.ingredientes || !option.preparacion) {
                        issues.push(`${section}-${mealTime}-Opcion ${i} incompleta`);
                    }
                }
            }
        }
        
        return { hasIssues: issues.length > 0, issues };
    }

}

export const mealPlanService = new MealPlanService();