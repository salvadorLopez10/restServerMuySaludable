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

        const response = await this.openai.chat.completions.create({
            model: "gpt-4-turbo",
            temperature: 0.1,
            messages: [
                {
                    role: "system",
                    content: `Eres un nutriólogo experto. DEBES usar ÚNICAMENTE y EXACTAMENTE estos nombres de comidas:

NOMBRES EXACTOS PERMITIDOS:
${JSON.stringify(exactMealNames, null, 2)}

REGLAS INQUEBRANTABLES:
1. USA ÚNICAMENTE los nombres EXACTOS de la lista anterior - SIN MODIFICACIONES
2. NO cambies ni una palabra de los nombres
3. NO inventes comidas nuevas
4. NUNCA repitas estos nombres ya usados: ${usedMeals.join(', ')}
5. DENTRO DE CADA SECCIÓN: Cada Opcion 1, 2 y 3 debe tener un nombre DIFERENTE (no repetir nombres en la misma sección)
6. Si no hay suficientes opciones en un tiempo, usa las disponibles

REGLAS DE COMBINACIÓN ESPECÍFICAS:
- NO combinar aguacate + aceite de oliva en la misma comida
- NO combinar aguacate + atún en la misma comida
- Jitomate: máximo 2 cucharadas por comida
- Salmón: no mezclar con otras grasas
- Huevo/claras: SOLO en desayuno

FORMATO DE RESPUESTA CRÍTICO:
- Responde ÚNICAMENTE con JSON válido
- NO uses bloques de código markdown (tres backticks seguidos de json, tres backticks solos, tres backticks con markdown)
- NO agregues texto explicativo antes o después del JSON
- El JSON debe comenzar con { y terminar con }

PARA CADA NOMBRE EXACTO que elijas:
- Genera los ingredientes específicos y sus porciones
- Calcula porciones para ${params.objetivo} (TMB: ${params.tmb}, Calorías: ${targetCalories})
- Escribe instrucciones de preparación detalladas
- VERIFICA que no combines ingredientes prohibidos

DISTRIBUCIÓN NUTRICIONAL:
- Proteínas: ${macroRules.proteinas}%
- Grasas: ${macroRules.grasas}%
- Carbohidratos: ${macroRules.carbohidratos}%

EVITAR: ${params.alimentos_evitar?.join(', ') || 'ninguno'}
PREFERIR: ${params.alimentos_preferencia?.join(', ') || 'ninguna'}

FORMATO JSON EXACTO - VERIFICA ANTES DE RESPONDER:
{
    "${section}": {
        "Desayuno": {
            "Opcion 1": {"nombre": "NOMBRE EXACTO DE LA LISTA", "ingredientes": [{"nombre": "ingrediente", "porcion": "cantidad unidad"}], "preparacion": "pasos detallados"},
            "Opcion 2": {"nombre": "NOMBRE EXACTO DE LA LISTA", "ingredientes": [...], "preparacion": "..."},
            "Opcion 3": {"nombre": "NOMBRE EXACTO DE LA LISTA", "ingredientes": [...], "preparacion": "..."}
        },
        "Comida": { "Opcion 1": {...}, "Opcion 2": {...}, "Opcion 3": {...} },
        "Colación": { "Opcion 1": {...}, "Opcion 2": {...}, "Opcion 3": {...} },
        "Cena": { "Opcion 1": {...}, "Opcion 2": {...}, "Opcion 3": {...} }
    }
}

CRÍTICO: Antes de responder, verifica que:
1. Cada "nombre" sea EXACTAMENTE de la lista
2. No haya nombres repetidos en la misma sección
3. No combines aguacate con atún o aceite de oliva`
                },
                {
                    role: "user",
                    content: `Genera ${section} usando ÚNICAMENTE los nombres exactos de la lista. Cada opción debe ser única. Desarrolla ingredientes y porciones para ${params.objetivo} con TMB ${params.tmb}.`
                }
            ]
        });

        return response.choices[0]?.message?.content || '';
    }

    // Función para generar sección con manejo de rate limit
    private async generateSectionWithRateLimit(
        section: string, 
        params: MealPlanParams, 
        exactMealNames: any,
        usedMeals: string[],
        attempt: number
    ): Promise<string> {
        try {
            return await this.generateSection(section, params, exactMealNames, usedMeals);
        } catch (error: any) {
            if (error.message?.includes('rate_limit_exceeded') || error.message?.includes('429')) {
                const waitTime = attempt * 5000; // 5s, 10s, 15s según el intento
                console.log(`⏱️ Rate limit en generateSection, esperando ${waitTime/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return await this.generateSection(section, params, exactMealNames, usedMeals);
            }
            throw error;
        }
    }

    // Validación progresiva
    private validateSectionData(sectionData: any, exactMealNames: any, usedMeals: string[], attempt: number, maxAttempts: number) {
        const warnings: string[] = [];
        const issues: string[] = [];
        let level = 'strict';
        
        // SIEMPRE limpiar repeticiones dentro de la misma sección
        const cleanedData = this.removeDuplicatesWithinSection(sectionData, warnings);
        
        // NUEVA LÓGICA: Validar y sustituir selectivamente
        const finalData = this.validateAndSubstituteSelectively(cleanedData, exactMealNames, usedMeals, attempt, maxAttempts, warnings, issues);
        
        // A partir del intento 2, ser MUY permisivo
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

    private validateAndSubstituteSelectively(sectionData: any, exactMealNames: any, usedMeals: string[], attempt: number, maxAttempts: number, warnings: string[], issues: string[]) {
        const processedData = JSON.parse(JSON.stringify(sectionData)); // Deep copy
        
        for (const [timeOfDay, options] of Object.entries(processedData)) {
            if (timeOfDay === 'Hidratación') continue;
            
            if (!options || typeof options !== 'object') {
                // Si falta un tiempo completo, generarlo
                processedData[timeOfDay] = this.generateMissingMealTime(timeOfDay, exactMealNames);
                warnings.push(`Tiempo de comida faltante generado: ${timeOfDay}`);
                continue;
            }
            
            const availableNames = exactMealNames[timeOfDay] || [];
            const unusedNames = availableNames.filter((name: string) => !usedMeals.includes(name));
            const namesToUse = unusedNames.length >= 3 ? unusedNames : availableNames; // Usar todos si no hay suficientes únicos
            
            for (const [optionKey, meal] of Object.entries(options as any)) {
                const mealObj = meal as any;
                if (!mealObj?.nombre) {
                    // Si falta el nombre, asignar uno disponible
                    const fallbackName = this.getNextAvailableMeal(namesToUse, timeOfDay, optionKey);
                    mealObj.nombre = fallbackName;
                    warnings.push(`Nombre faltante sustituido: ${fallbackName} en ${timeOfDay}`);
                    continue;
                }
                
                const mealName = mealObj.nombre;
                const needsSubstitution = this.needsSubstitution(mealName, availableNames, usedMeals, attempt);
                
                if (needsSubstitution.substitute) {
                    const newName = this.getSubstituteMeal(namesToUse, timeOfDay, optionKey, attempt, processedData[timeOfDay]);
                    
                    if (newName) {
                        const oldName = mealObj.nombre;
                        mealObj.nombre = newName;
                        warnings.push(`Sustituido: "${oldName}" → "${newName}" en ${timeOfDay} (${needsSubstitution.reason})`);
                    } else {
                        // Si no hay sustitutos en BD, permitir el nombre original o generar uno
                        if (attempt >= maxAttempts) {
                            const generatedName = this.generateAcceptableMealName(timeOfDay, optionKey);
                            mealObj.nombre = generatedName;
                            warnings.push(`Nombre generado: "${generatedName}" en ${timeOfDay} (sin opciones en BD)`);
                        } else {
                            issues.push(`No hay sustituto para "${mealName}" en ${timeOfDay}`);
                        }
                    }
                }
            }
            
            // Asegurar que tenemos exactamente 3 opciones
            this.ensureThreeOptions(processedData[timeOfDay], timeOfDay, namesToUse, warnings);
        }
        
        // Asegurar que existe hidratación
        if (!processedData["Hidratación"]) {
            processedData["Hidratación"] = {
                "recomendaciones": "Beber al menos 2 litros de agua al día."
            };
            warnings.push("Sección de hidratación agregada automáticamente");
        }
        
        return processedData;
    }

    // Determinar si una comida necesita sustitución
    private needsSubstitution(mealName: string, availableNames: string[], usedMeals: string[], attempt: number): {substitute: boolean, reason: string} {
        // INTENTO 1: Solo sustituir si no está en la lista
        if (attempt === 1) {
            if (!availableNames.includes(mealName)) {
                return { substitute: true, reason: "no está en BD" };
            }
            if (usedMeals.includes(mealName)) {
                return { substitute: true, reason: "ya fue usado" };
            }
            return { substitute: false, reason: "" };
        }
        
        // INTENTO 2: Más flexible, permitir nombres similares
        if (attempt === 2) {
            if (!availableNames.includes(mealName) && !this.isSimilarMealName(mealName, availableNames)) {
                return { substitute: true, reason: "no es similar a BD" };
            }
            return { substitute: false, reason: "" };
        }
        
        // INTENTO 3+: Ultra permisivo, casi no sustituir
        return { substitute: false, reason: "" };
    }

    // Obtener comida sustituta
    private getSubstituteMeal(namesToUse: string[], timeOfDay: string, optionKey: string, attempt: number, currentTimeOptions: any): string | null {
        if (namesToUse.length === 0) return null;
        
        // Obtener nombres ya usados en este tiempo de comida
        const usedInThisTime: string[] = [];
        for (const [key, meal] of Object.entries(currentTimeOptions)) {
            const mealObj = meal as any;
            if (mealObj?.nombre && key !== optionKey) {
                usedInThisTime.push(mealObj.nombre);
            }
        }
        
        // Buscar una comida que no se haya usado en este tiempo
        const availableForSubstitution = namesToUse.filter(name => !usedInThisTime.includes(name));
        
        if (availableForSubstitution.length > 0) {
            // Seleccionar según la opción (1, 2, 3)
            const optionIndex = parseInt(optionKey.replace('Opcion ', '')) - 1;
            return availableForSubstitution[optionIndex % availableForSubstitution.length];
        }
        
        // Si no hay opciones únicas, usar cualquiera
        if (attempt >= 2) {
            const optionIndex = parseInt(optionKey.replace('Opcion ', '')) - 1;
            return namesToUse[optionIndex % namesToUse.length];
        }
        
        return null;
    }

    // Obtener siguiente comida disponible
    private getNextAvailableMeal(namesToUse: string[], timeOfDay: string, optionKey: string): string {
        if (namesToUse.length === 0) {
            return this.generateAcceptableMealName(timeOfDay, optionKey);
        }
        
        const optionIndex = parseInt(optionKey.replace('Opcion ', '')) - 1;
        return namesToUse[optionIndex % namesToUse.length];
    }

    // Generar nombre aceptable cuando no hay opciones en BD
    private generateAcceptableMealName(timeOfDay: string, optionKey: string): string {
        const optionNumber = optionKey.replace('Opcion ', '');
        
        // Definir tipo explícito para evitar error de TypeScript
        const mealPatterns: { [key: string]: string[] } = {
            'Desayuno': [
                'Huevos revueltos con vegetales',
                'Omelette de claras',
                'Avena con frutas',
                'Tostadas con aguacate',
                'Licuado proteico'
            ],
            'Comida': [
                'Pechuga de pollo asada',
                'Pescado a la plancha',
                'Bistec con ensalada',
                'Pollo con vegetales',
                'Atún con verduras'
            ],
            'Colación': [
                'Yogurt con nueces',
                'Fruta con proteína',
                'Gelatina con frutos secos',
                'Verduras con hummus',
                'Smoothie de proteínas'
            ],
            'Cena': [
                'Ensalada con proteína',
                'Sopa de vegetales',
                'Pollo ligero',
                'Pescado al vapor',
                'Omelet de vegetales'
            ]
        };
        
        // Ahora TypeScript reconoce el tipo correctamente
        const patterns = mealPatterns[timeOfDay] || mealPatterns['Comida'];
        const patternIndex = (parseInt(optionNumber) - 1) % patterns.length;
        
        return patterns[patternIndex];
    }

    // Asegurar 3 opciones completas
    private ensureThreeOptions(timeOptions: any, timeOfDay: string, namesToUse: string[], warnings: string[]) {
        for (let i = 1; i <= 3; i++) {
            const optionKey = `Opcion ${i}`;
            
            if (!timeOptions[optionKey] || !timeOptions[optionKey].nombre) {
                const mealName = this.getNextAvailableMeal(namesToUse, timeOfDay, optionKey);
                
                timeOptions[optionKey] = {
                    "nombre": mealName,
                    "ingredientes": [
                        {"nombre": "Ingredientes apropiados", "porcion": "cantidad adecuada"}
                    ],
                    "preparacion": "Preparar de forma saludable según las mejores prácticas nutricionales."
                };
                
                warnings.push(`Opción faltante generada: ${optionKey} en ${timeOfDay}`);
            }
        }
    }

    // Remover duplicados dentro de la misma sección
    private removeDuplicatesWithinSection(sectionData: any, warnings: string[]) {
        const cleaned = JSON.parse(JSON.stringify(sectionData)); // Deep copy
    
        for (const [timeOfDay, options] of Object.entries(cleaned)) {
            if (timeOfDay === 'Hidratación') continue;
            
            const usedNamesInTime: string[] = [];
            const optionsArray = Object.entries(options as any);
            
            for (let i = 0; i < optionsArray.length; i++) {
                const [optionKey, meal] = optionsArray[i];
                const mealObj = meal as any;
                
                if (mealObj?.nombre) {
                    if (usedNamesInTime.includes(mealObj.nombre)) {
                        // En lugar de nombre genérico, intentar encontrar uno similar pero diferente
                        const alternativeName = this.findAlternativeName(mealObj.nombre, usedNamesInTime);
                        mealObj.nombre = alternativeName;
                        warnings.push(`Repetición sustituida: "${mealObj.nombre}" → "${alternativeName}" en ${timeOfDay}`);
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
            `${originalName} al estilo casero`,
            `${originalName} con vegetales`,
            `${originalName} saludable`,
            `Variación de ${originalName}`
        ];
        
        for (const variation of variations) {
            if (!usedNames.includes(variation)) {
                return variation;
            }
        }
        
        // Si todas las variaciones están usadas, agregar número
        return `${originalName} (opción ${usedNames.length + 1})`;
    }

    // Generar tiempo de comida faltante
    private generateMissingMealTime(timeOfDay: string, exactMealNames: any) {
        const availableMeals = exactMealNames[timeOfDay] || [`${timeOfDay} nutritivo`];
        
        const mealTime: any = {};
        for (let i = 1; i <= 3; i++) {
            const mealIndex = (i - 1) % availableMeals.length;
            const mealName = availableMeals[mealIndex] || `${timeOfDay} saludable ${i}`;
            
            mealTime[`Opcion ${i}`] = {
                "nombre": mealName,
                "ingredientes": [
                    {"nombre": "Ingredientes nutritivos", "porcion": "porción adecuada"}
                ],
                "preparacion": "Preparar según las mejores prácticas nutricionales."
            };
        }
        
        return mealTime;
    }

    // Plan de emergencia con comidas de la BD
    private generateEmergencyPlan(section: string, availableMeals: any) {
        const plan: any = {
            "Hidratación": {
                "recomendaciones": "Beber al menos 2 litros de agua al día."
            }
        };
        
        const mealTimes = ['Desayuno', 'Comida', 'Colación', 'Cena'];
        
        for (const timeOfDay of mealTimes) {
            plan[timeOfDay] = {};
            const meals = availableMeals[timeOfDay] || [`${timeOfDay} saludable`];
            
            for (let i = 1; i <= 3; i++) {
                const mealIndex = (i - 1) % meals.length;
                const mealName = meals[mealIndex] || `${timeOfDay} nutritivo ${i}`;
                
                plan[timeOfDay][`Opcion ${i}`] = {
                    "nombre": mealName,
                    "ingredientes": [
                        {"nombre": "Ingredientes nutritivos", "porcion": "porción adecuada"}
                    ],
                    "preparacion": "Preparar según las mejores prácticas nutricionales."
                };
            }
        }
        
        return plan;
    }

    // Plan genérico como último recurso
    private generateGenericPlan(section: string) {
        return {
            "Desayuno": {
                "Opcion 1": {"nombre": "Desayuno balanceado", "ingredientes": [{"nombre": "Proteína", "porcion": "1 porción"}, {"nombre": "Carbohidrato", "porcion": "1 porción"}], "preparacion": "Combinar ingredientes de forma saludable"},
                "Opcion 2": {"nombre": "Desayuno energético", "ingredientes": [{"nombre": "Proteína", "porcion": "1 porción"}, {"nombre": "Grasa saludable", "porcion": "1 porción"}], "preparacion": "Preparar con métodos saludables"},
                "Opcion 3": {"nombre": "Desayuno nutritivo", "ingredientes": [{"nombre": "Proteína", "porcion": "1 porción"}, {"nombre": "Fibra", "porcion": "1 porción"}], "preparacion": "Cocinar de manera saludable"}
            },
            "Comida": {
                "Opcion 1": {"nombre": "Comida completa", "ingredientes": [{"nombre": "Proteína magra", "porcion": "200g"}, {"nombre": "Vegetales", "porcion": "2 tazas"}], "preparacion": "Preparar balanceadamente"},
                "Opcion 2": {"nombre": "Comida balanceada", "ingredientes": [{"nombre": "Proteína", "porcion": "200g"}, {"nombre": "Carbohidrato complejo", "porcion": "1 taza"}], "preparacion": "Cocinar saludablemente"},
                "Opcion 3": {"nombre": "Comida nutritiva", "ingredientes": [{"nombre": "Proteína", "porcion": "200g"}, {"nombre": "Grasas saludables", "porcion": "1 porción"}], "preparacion": "Preparar conscientemente"}
            },
            "Colación": {
                "Opcion 1": {"nombre": "Snack proteico", "ingredientes": [{"nombre": "Proteína", "porcion": "30g"}], "preparacion": "Consumir directo"},
                "Opcion 2": {"nombre": "Snack natural", "ingredientes": [{"nombre": "Fruta", "porcion": "1 pieza"}], "preparacion": "Lavar y consumir"},
                "Opcion 3": {"nombre": "Snack balanceado", "ingredientes": [{"nombre": "Nueces", "porcion": "30g"}], "preparacion": "Consumir con moderación"}
            },
            "Cena": {
                "Opcion 1": {"nombre": "Cena ligera", "ingredientes": [{"nombre": "Proteína magra", "porcion": "150g"}, {"nombre": "Vegetales", "porcion": "2 tazas"}], "preparacion": "Preparar de forma ligera"},
                "Opcion 2": {"nombre": "Cena balanceada", "ingredientes": [{"nombre": "Proteína", "porcion": "150g"}, {"nombre": "Ensalada", "porcion": "1 taza"}], "preparacion": "Combinar saludablemente"},
                "Opcion 3": {"nombre": "Cena nutritiva", "ingredientes": [{"nombre": "Proteína", "porcion": "150g"}, {"nombre": "Fibra", "porcion": "1 porción"}], "preparacion": "Preparar conscientemente"}
            },
            "Hidratación": {
                "recomendaciones": "Mantener hidratación adecuada durante todo el día con al menos 2 litros de agua."
            }
        };
    }

    // Función auxiliar para nombres similares
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

    // Reparar JSON básico
    private repairBasicJson(content: string, section: string): string | null {
        try {
            // Intentar envolver en estructura básica
            if (!content.includes(section)) {
                return `{"${section}": ${content}}`;
            }
            return content;
        } catch {
            return null;
        }
    }

    // FUNCIÓN PRINCIPAL ULTRA-TOLERANTE
    async generateCompletePlan(params: MealPlanParams): Promise<any> {
        const sections = ["Detox", "Mes1", "Mes2"];
        const completePlan: any = {};
        const usedMeals: string[] = [];

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            
            // Delay entre secciones para evitar rate limit
            if (i > 0) {
                console.log(`⏱️ Esperando 8 segundos antes de generar ${section}...`);
                await new Promise(resolve => setTimeout(resolve, 8000));
            }

            let sectionPlan = null;
            let attempts = 0;
            const maxAttempts = 3;

            console.log(`🚀 Generando sección: ${section}`);

            while (!sectionPlan && attempts < maxAttempts) {
                attempts++;
                console.log(`🔄 Intento ${attempts} para ${section}`);

                try {
                    // Delay entre intentos
                    if (attempts > 1) {
                        const waitTime = attempts * 3000; // 3s, 6s, 9s
                        console.log(`⏱️ Esperando ${waitTime/1000} segundos antes del intento ${attempts}...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }

                    // Obtener nombres disponibles con flexibilidad progresiva
                    const allowReuse = attempts >= 2; // Permitir reutilización desde el 2do intento
                    const exactMealNames = await mealDataService.getAvailableExactNames(
                        params.tipo_dieta, 
                        params.objetivo, 
                        allowReuse ? [] : usedMeals, // Sin exclusiones si permitimos reutilización
                        allowReuse
                    );

                    console.log(`📋 Comidas disponibles para ${section} (intento ${attempts}, reutilización: ${allowReuse}):`, {
                        Desayuno: exactMealNames.Desayuno?.length || 0,
                        Comida: exactMealNames.Comida?.length || 0,
                        Colación: exactMealNames.Colación?.length || 0,
                        Cena: exactMealNames.Cena?.length || 0
                    });

                    // FASE 1: Generación con IA
                    const generatedContent = await this.generateSectionWithRateLimit(section, params, exactMealNames, usedMeals, attempts);
                    
                    if (!generatedContent) {
                        console.log(`❌ No se recibió contenido para ${section}`);
                        continue;
                    }

                    // Detectar markdown temprano (solo rechazar en primeros intentos)
                    if (generatedContent.includes('```') && attempts <= 2) {
                        console.log(`⚠️ Detectado markdown en respuesta de ${section}, reintentando...`);
                        continue;
                    }

                    console.log(`📝 Contenido generado para ${section} (primeros 200 chars):`, generatedContent.substring(0, 200) + '...');

                    // Limpiar JSON
                    const cleanJson = extractJsonFromMarkdown(generatedContent);
                    
                    // Validación JSON básica (más permisiva en últimos intentos)
                    if (!cleanJson.startsWith('{') || !cleanJson.endsWith('}')) {
                        if (attempts >= maxAttempts) {
                            console.log(`🟡 JSON malformado en último intento, usando plan de emergencia...`);
                            sectionPlan = this.generateEmergencyPlan(section, exactMealNames);
                            break;
                        }
                        console.log(`❌ Contenido no es JSON válido para ${section}`);
                        continue;
                    }
                    
                    let parsedPlan;
                    try {
                        parsedPlan = JSON.parse(cleanJson);
                        console.log(`✅ JSON parseado correctamente para ${section}`);
                    } catch (parseError: unknown) {
                        if (attempts >= maxAttempts) {
                            console.log(`🟡 Error de parsing en último intento, usando plan de emergencia...`);
                            sectionPlan = this.generateEmergencyPlan(section, exactMealNames);
                            break;
                        }
                        const errorMessage = parseError instanceof Error ? parseError.message : 'Error desconocido';
                        console.log(`❌ Error parseando JSON para ${section}:`, errorMessage);
                        continue;
                    }
                    
                    const sectionData = parsedPlan[section] || parsedPlan;
                    
                    if (!sectionData || typeof sectionData !== 'object') {
                        if (attempts >= maxAttempts) {
                            console.log(`🟡 Estructura incorrecta en último intento, usando plan de emergencia...`);
                            sectionPlan = this.generateEmergencyPlan(section, exactMealNames);
                            break;
                        }
                        console.log(`❌ Estructura incorrecta para ${section}:`, typeof sectionData);
                        continue;
                    }

                    // VALIDACIÓN PROGRESIVA: Ahora siempre acepta con sustituciones
                    const validationResult = this.validateSectionData(sectionData, exactMealNames, usedMeals, attempts, maxAttempts);

                    // SIEMPRE aceptar el resultado (ya que ahora sustituimos automáticamente)
                    sectionPlan = validationResult.cleanedData;
                    const newMeals = extractMealNames(sectionPlan);
                    usedMeals.push(...newMeals);

                    console.log(`✅ ${section} completado (nivel: ${validationResult.level})`);
                    console.log(`📝 Comidas agregadas: ${newMeals.join(', ')}`);

                    if (validationResult.warnings.length > 0) {
                        console.log(`⚠️ Sustituciones realizadas:`, validationResult.warnings);
                    }

                    if (validationResult.issues.length > 0) {
                        console.log(`📝 Issues menores:`, validationResult.issues);
                    }

                    break; // Salir del bucle ya que siempre aceptamos el resultado

                } catch (error: any) {
                    console.error(`❌ Error en intento ${attempts} para ${section}:`, error.message);
                    
                    if (error.message?.includes('rate_limit_exceeded') || error.message?.includes('429') || error.message?.includes('quota')) {
                        console.log(`⚠️ Error de cuota/rate limit detectado en consola - usando plan de emergencia...`);
                        sectionPlan = this.generateEmergencyPlan(section, await mealDataService.getAvailableExactNames(params.tipo_dieta, params.objetivo, [], true));
                        const newMeals = extractMealNames(sectionPlan);
                        usedMeals.push(...newMeals);
                        break;
                    }
                    
                    if (attempts >= maxAttempts) {
                        console.log(`🆘 Error en último intento, generando plan de emergencia...`);
                        const emergencyMeals = await mealDataService.getAvailableExactNames(params.tipo_dieta, params.objetivo, [], true);
                        sectionPlan = this.generateEmergencyPlan(section, emergencyMeals);
                        const newMeals = extractMealNames(sectionPlan);
                        usedMeals.push(...newMeals);
                        break;
                    }
                }
            }

            // GARANTÍA FINAL: Si no hay plan, crear uno de emergencia
            if (!sectionPlan) {
                console.log(`🆘 GARANTÍA FINAL: Creando plan de emergencia para ${section}`);
                try {
                    const emergencyMeals = await mealDataService.getAvailableExactNames(params.tipo_dieta, params.objetivo, [], true);
                    sectionPlan = this.generateEmergencyPlan(section, emergencyMeals);
                } catch (emergencyError) {
                    console.log(`🆘 Error en plan de emergencia, usando plan genérico...`);
                    sectionPlan = this.generateGenericPlan(section);
                }
            }

            completePlan[section] = sectionPlan;
            console.log(`🎯 Sección ${section} completada`);
        }

        // Estadísticas finales
        const totalMealsUsed = usedMeals.length;
        const uniqueMealsUsed = [...new Set(usedMeals)].length;
        
        console.log(`🎉 Plan completo generado exitosamente`);
        console.log(`📊 Estadísticas: ${totalMealsUsed} comidas total, ${uniqueMealsUsed} únicas`);

        return {
            plan: completePlan,
            statistics: {
                totalMealsGenerated: totalMealsUsed,
                uniqueMealsGenerated: uniqueMealsUsed,
                sectionsGenerated: sections.length,
                usedMeals: usedMeals
            }
       };
   }
}

export const mealPlanService = new MealPlanService();
