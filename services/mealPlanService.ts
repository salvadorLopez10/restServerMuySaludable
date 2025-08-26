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
        const nutritionRules = DIET_TYPE_RULES[params.tipo_dieta] || DIET_TYPE_RULES['Balanceada'];
        const targetCalories = params.tmb + macroRules.caloriasAjuste;

        // Limitar usedMeals para evitar prompts muy largos
        const recentUsedMeals = usedMeals.slice(-20); // Solo últimas 20 comidas

        const response = await this.openai.chat.completions.create({
            model: "gpt-4-turbo",
            temperature: 0.1,
            max_tokens: 4000,
            messages: [
                {
                    role: "system",
                    content: `Eres un nutriólogo experto. DEBES usar ÚNICAMENTE nombres de estas comidas disponibles:

NOMBRES DISPONIBLES POR TIEMPO:
${JSON.stringify(exactMealNames, null, 2)}

REGLAS CRÍTICAS DE NOMBRES:
1. USA SOLO nombres de la lista anterior
2. NO repitas estos nombres recientes: ${recentUsedMeals.join(', ')}
3. Cada Opción 1, 2, 3 debe tener nombre DIFERENTE
4. Si no hay opciones suficientes, usa variaciones del nombre

RESTRICCIONES NUTRICIONALES OBLIGATORIAS:
${NUTRITION_RULES}

RESTRICCIONES ESPECÍFICAS PARA DIETA ${params.tipo_dieta.toUpperCase()}:
${JSON.stringify(nutritionRules, null, 2)}

ALIMENTOS PROHIBIDOS (NO INCLUIR NUNCA):
${params.alimentos_evitar?.join(', ') || 'ninguno'}

ALIMENTOS A PREFERIR:
${params.alimentos_preferencia?.join(', ') || 'ninguna'}

MACRONUTRIENTES OBJETIVO:
- Calorías: ${targetCalories}
- Proteínas: ${macroRules.proteinas}%
- Grasas: ${macroRules.grasas}%
- Carbohidratos: ${macroRules.carbohidratos}%

REGLAS DE INGREDIENTES CRÍTICAS:
1. Los ingredientes DEBEN coincidir con el nombre de la comida
2. "Yogurt griego con almendras" → ingredientes: yogurt + almendras
3. "Apios con limón" → ingredientes: apio + limón
4. NUNCA pongas ingredientes que no correspondan al nombre
5. RESPETA todas las restricciones nutricionales
6. NO uses ingredientes de la lista PROHIBIDA

FORMATO JSON EXACTO:
{
    "${section}": {
        "Desayuno": {
            "Opcion 1": {"nombre": "NOMBRE DE LA LISTA", "ingredientes": [{"nombre": "ingrediente correcto", "porcion": "cantidad"}], "preparacion": "pasos coherentes"},
            "Opcion 2": {"nombre": "NOMBRE DIFERENTE", "ingredientes": [...], "preparacion": "..."},
            "Opcion 3": {"nombre": "NOMBRE DIFERENTE", "ingredientes": [...], "preparacion": "..."}
        },
        "Comida": { "Opcion 1": {...}, "Opcion 2": {...}, "Opcion 3": {...} },
        "Colación": { "Opcion 1": {...}, "Opcion 2": {...}, "Opcion 3": {...} },
        "Cena": { "Opcion 1": {...}, "Opcion 2": {...}, "Opcion 3": {...} },
    }
}

VERIFICACIÓN FINAL OBLIGATORIA:
1. ¿Los ingredientes coinciden con el nombre?
2. ¿Se respetan las restricciones nutricionales?
3. ¿No hay ingredientes prohibidos?
4. ¿Cada opción tiene nombre diferente?`
                },
                {
                    role: "user",
                    content: `Genera ${section} respetando TODAS las restricciones. Intento ${attempt} de 3.`
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
                    
                    if (totalAvailable < 12 && attempts === 1) {
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

        return {
            plan: completePlan,
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

        // Detectar markdown temprano
        if (generatedContent.includes('```') && attempts <= 2) {
            console.log(`Detectado markdown en respuesta de ${section}, reintentando...`);
            return null;
        }

        console.log(`Contenido generado para ${section} (primeros 200 chars):`, generatedContent.substring(0, 200) + '...');

        // Limpiar JSON
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
        
        const sectionData = parsedPlan[section] || parsedPlan;
        
        if (!sectionData || typeof sectionData !== 'object') {
            if (attempts >= maxAttempts) {
                console.log(`Estructura incorrecta en último intento, usando plan de emergencia...`);
                return this.generateEmergencyPlan(section, exactMealNames, params);
            }
            console.log(`Estructura incorrecta para ${section}:`, typeof sectionData);
            return null;
        }

        // VALIDACIÓN Y CORRECCIÓN
        const validationResult = this.validateSectionData(sectionData, exactMealNames, usedMeals, attempts, maxAttempts, params);

        // SIEMPRE aceptar el resultado ya corregido
        console.log(`${section} completado (nivel: ${validationResult.level})`);

        if (validationResult.warnings.length > 0) {
            console.log(`Correcciones aplicadas:`, validationResult.warnings);
        }

        if (validationResult.issues.length > 0) {
            console.log(`Issues menores:`, validationResult.issues);
        }

        return validationResult.cleanedData;
    }
}

export const mealPlanService = new MealPlanService();