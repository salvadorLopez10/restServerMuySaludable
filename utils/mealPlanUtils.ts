// REEMPLAZAR las funciones en utils/mealPlanUtils.ts

export function extractJsonFromMarkdown(content: string): string {
    let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    return cleaned;
}

export function extractMealNames(sectionPlan: any): string[] {
    const mealNames: string[] = [];
    
    if (!sectionPlan || typeof sectionPlan !== 'object') {
        return mealNames;
    }
    
    const mealTimes = ['Desayuno', 'Comida', 'Colación', 'Cena'];
    
    for (const timeOfDay of mealTimes) {
        const timeOptions = sectionPlan[timeOfDay];
        
        if (timeOptions && typeof timeOptions === 'object') {
            for (let i = 1; i <= 3; i++) {
                const option = timeOptions[`Opcion ${i}`];
                if (option?.nombre && typeof option.nombre === 'string') {
                    // Solo agregar nombres únicos
                    if (!mealNames.includes(option.nombre)) {
                        mealNames.push(option.nombre);
                    }
                }
            }
        }
    }
    
    return mealNames;
}

export function validateMealStructure(mealPlan: any): boolean {
    if (!mealPlan || typeof mealPlan !== 'object') {
        return false;
    }
    
    const requiredTimes = ['Desayuno', 'Comida', 'Colación', 'Cena'];
    
    for (const timeOfDay of requiredTimes) {
        const timeOptions = mealPlan[timeOfDay];
        
        if (!timeOptions || typeof timeOptions !== 'object') {
            return false;
        }
        
        // Verificar que tenga las 3 opciones
        for (let i = 1; i <= 3; i++) {
            const option = timeOptions[`Opcion ${i}`];
            
            if (!option || 
                !option.nombre || 
                !option.ingredientes || 
                !option.preparacion ||
                !Array.isArray(option.ingredientes)) {
                return false;
            }
        }
    }
    
    return true;
}

export function removeDuplicatesAcrossSections(completePlan: any): any {
    const cleanedPlan = JSON.parse(JSON.stringify(completePlan));
    const globalUsedNames: string[] = [];
    const sections = ['Detox', 'Mes1', 'Mes2'];
    
    for (const section of sections) {
        const sectionPlan = cleanedPlan[section];
        
        if (!sectionPlan) continue;
        
        const mealTimes = ['Desayuno', 'Comida', 'Colación', 'Cena'];
        
        for (const timeOfDay of mealTimes) {
            const timeOptions = sectionPlan[timeOfDay];
            
            if (!timeOptions) continue;
            
            for (let i = 1; i <= 3; i++) {
                const option = timeOptions[`Opcion ${i}`];
                
                if (option?.nombre) {
                    if (globalUsedNames.includes(option.nombre)) {
                        // Generar nombre alternativo
                        option.nombre = `${option.nombre} (${section})`;
                    }
                    globalUsedNames.push(option.nombre);
                }
            }
        }
    }
    
    return cleanedPlan;
}

export function validateIngredientRestrictions(
    ingredientes: any[], 
    alimentos_evitar: string[]
): { isValid: boolean, problematicIngredients: string[] } {
    
    if (!Array.isArray(ingredientes) || !Array.isArray(alimentos_evitar)) {
        return { isValid: true, problematicIngredients: [] };
    }
    
    const problematicIngredients: string[] = [];
    const avoidedLower = alimentos_evitar.map(item => item.toLowerCase());
    
    for (const ingredient of ingredientes) {
        if (!ingredient?.nombre) continue;
        
        const ingredientName = ingredient.nombre.toLowerCase();
        
        for (const avoided of avoidedLower) {
            if (ingredientName.includes(avoided)) {
                problematicIngredients.push(ingredient.nombre);
                break;
            }
        }
    }
    
    return {
        isValid: problematicIngredients.length === 0,
        problematicIngredients
    };
}

export function applyNutritionRules(mealPlan: any, nutritionRules: any, params: any): any {
    if (!nutritionRules || !mealPlan) {
        return mealPlan;
    }
    
    let processedPlan = JSON.parse(JSON.stringify(mealPlan));
    
    // Aplicar restricciones específicas por tipo de dieta
    if (nutritionRules.prohibited_foods && Array.isArray(nutritionRules.prohibited_foods)) {
        processedPlan = removeProhibitedIngredientsFromPlan(processedPlan, nutritionRules.prohibited_foods);
    }
    
    // Aplicar restricciones de macronutrientes si existen
    if (nutritionRules.macronutrient_limits) {
        processedPlan = adjustPortionsForMacros(processedPlan, nutritionRules.macronutrient_limits, params);
    }
    
    return processedPlan;
}

function removeProhibitedIngredientsFromPlan(plan: any, prohibitedFoods: string[]): any {
    const sections = ['Detox', 'Mes1', 'Mes2'];
    const mealTimes = ['Desayuno', 'Comida', 'Colación', 'Cena'];
    
    for (const section of sections) {
        if (!plan[section]) continue;
        
        for (const timeOfDay of mealTimes) {
            if (!plan[section][timeOfDay]) continue;
            
            for (let i = 1; i <= 3; i++) {
                const option = plan[section][timeOfDay][`Opcion ${i}`];
                
                if (option?.ingredientes && Array.isArray(option.ingredientes)) {
                    option.ingredientes = option.ingredientes.filter((ingredient: any) => {
                        if (!ingredient?.nombre) return true;
                        
                        const ingredientName = ingredient.nombre.toLowerCase();
                        return !prohibitedFoods.some(prohibited => 
                            ingredientName.includes(prohibited.toLowerCase())
                        );
                    });
                }
            }
        }
    }
    
    return plan;
}

function adjustPortionsForMacros(plan: any, macroLimits: any, params: any): any {
    // Esta función ajustaría las porciones basándose en los límites de macronutrientes
    // Por ahora retornamos el plan sin modificar, pero aquí se implementaría la lógica
    return plan;
}