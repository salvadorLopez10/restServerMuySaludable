export const NUTRITION_RULES = `
REGLAS DE FILTRADO Y COMBINACIÓN DE INGREDIENTES:
* Claras y huevo: Sólo en desayuno (excepto platillos como albóndigas).
* No combinar aguacate + aceite de oliva en la misma comida.
* Jitomate: máximo 2 cucharadas por comida.
* Salmón: no mezclar con otras grasas.
* Prohibidos: carnes procesadas, embutidos, bebidas azucaradas, horneado.
* No usar "palta", "apio con crema de almendras", ni nombres no comunes en México.
* Cambiar "unidades" por "pieza".
REGLAS DE VARIEDAD Y NO REPETICIÓN:
* Cada tiempo de comida debe tener exactamente 3 opciones diferentes.
* No repetir el mismo platillo (nombre exacto) en otro mes.
* No repetir preparaciones similares con ligeras variaciones.
* Si se repite un ingrediente, debe cambiar completamente la forma de preparación.
* Utilizar el orden numérico de los archivos JSON por tipo de dieta.
* Priorizar ingredientes de temporada.
* Salsas deben ser caseras, sin conservadores ni azúcar.
VALIDACIONES OBLIGATORIAS:
* Asegurar proporciones calóricas y proteicas por objetivo.
* Verificar que los ingredientes no estén en la lista de "evitar".
* No deben aparecer ingredientes prohibidos en nombre del platillo ni en preparación.
* Verificar compatibilidad en planes sin gluten o veganos.
* Confirmar que cada comida sea fácil de preparar (sin horno, sin técnicas avanzadas).
`;

// Reglas específicas por tipo de dieta (para validaciones programáticas)
export const DIET_TYPE_RULES: { [key: string]: any } = {
    'Todo': {
        prohibited_ingredients: ['carnes procesadas', 'embutidos', 'bebidas azucaradas'],
        allowed_ingredients: ['todo'],
        special_restrictions: []
    },
    'Vegano': {
        prohibited_ingredients: [
            'pollo', 'pescado', 'carne', 'bistec', 'atún', 'salmón', 'huevo', 'huevos',
            'claras', 'leche', 'queso', 'yogurt', 'mantequilla', 'crema', 'miel',
            'carnes procesadas', 'embutidos', 'bebidas azucaradas'
        ],
        allowed_ingredients: [
            'vegetales', 'frutas', 'legumbres', 'cereales', 'nueces', 'semillas',
            'tofu', 'tempeh', 'quinoa', 'avena', 'arroz', 'frijoles', 'lentejas'
        ],
        special_restrictions: ['Sin productos de origen animal']
    },
    'Vegetariano': {
        prohibited_ingredients: [
            'pollo', 'pescado', 'carne', 'bistec', 'atún', 'salmón',
            'carnes procesadas', 'embutidos', 'bebidas azucaradas'
        ],
        allowed_ingredients: [
            'vegetales', 'frutas', 'legumbres', 'cereales', 'nueces', 'semillas',
            'huevos', 'lácteos', 'queso', 'yogurt', 'leche', 'quinoa', 'avena'
        ],
        special_restrictions: ['Sin carne', 'Sin pescado']
    },
    'Balanceada': {
        prohibited_ingredients: ['carnes procesadas', 'embutidos', 'bebidas azucaradas'],
        allowed_ingredients: ['todo'],
        special_restrictions: []
    }
};

export const MACRONUTRIENT_RULES: { [key: string]: any } = {
    'Bajar grasa y comer saludable': { 
        proteinas: 30, 
        grasas: 30, 
        carbohidratos: 40, 
        caloriasAjuste: -600,
        protein_per_meal_min: 100,
        protein_per_meal_max: 150
    },
    'Low Carb y definición muscular': { 
        proteinas: 25, 
        grasas: 70, 
        carbohidratos: 5, 
        caloriasAjuste: -400,
        protein_per_meal_min: 100,
        protein_per_meal_max: 120
    },
    'Mantenimiento': { 
        proteinas: 25, 
        grasas: 25, 
        carbohidratos: 50, 
        caloriasAjuste: 0,
        protein_per_meal_min: 120,
        protein_per_meal_max: 180
    },
    'Subir masa muscular': { 
        proteinas: 35, 
        grasas: 20, 
        carbohidratos: 45, 
        caloriasAjuste: 600,
        protein_per_meal_min: 180,
        protein_per_meal_max: 250
    }
};

// Función para validar ingredientes según tipo de dieta
export function validateIngredientsByDiet(
    ingredientes: any[], 
    dietType: string, 
    userAvoidedFoods: string[]
): { isValid: boolean, violations: string[], correctedIngredients?: any[] } {
    const violations: string[] = [];
    const dietRules = DIET_TYPE_RULES[dietType];
    
    if (!dietRules) {
        return { isValid: true, violations: [] };
    }

    // Verificar ingredientes prohibidos por tipo de dieta
    for (const ingredient of ingredientes) {
        if (!ingredient?.nombre) continue;
        
        const ingredientName = ingredient.nombre.toLowerCase();
        
        // Verificar contra ingredientes prohibidos por dieta
        for (const prohibited of dietRules.prohibited_ingredients) {
            if (ingredientName.includes(prohibited.toLowerCase())) {
                violations.push(`Ingrediente prohibido para dieta ${dietType}: ${ingredient.nombre}`);
            }
        }
        
        // Verificar contra ingredientes evitados por usuario
        for (const avoided of userAvoidedFoods) {
            if (ingredientName.includes(avoided.toLowerCase())) {
                violations.push(`Ingrediente evitado por usuario: ${ingredient.nombre}`);
            }
        }
    }

    // Generar ingredientes corregidos si hay violaciones
    let correctedIngredients;
    if (violations.length > 0) {
        correctedIngredients = ingredientes.filter(ingredient => {
            if (!ingredient?.nombre) return false;
            
            const ingredientName = ingredient.nombre.toLowerCase();
            
            // Remover ingredientes prohibidos por dieta
            const isProhibited = dietRules.prohibited_ingredients.some((prohibited: string) => 
                ingredientName.includes(prohibited.toLowerCase())
            );
            
            // Remover ingredientes evitados por usuario
            const isAvoided = userAvoidedFoods.some(avoided => 
                ingredientName.includes(avoided.toLowerCase())
            );
            
            return !isProhibited && !isAvoided;
        });
    }

    return {
        isValid: violations.length === 0,
        violations,
        correctedIngredients
    };
}

// Función para validar reglas específicas de combinación
export function validateCombinationRules(
    mealName: string,
    ingredientes: any[], 
    timeOfDay: string
): { isValid: boolean, violations: string[], correctedIngredients?: any[] } {
    const violations: string[] = [];
    const ingredientNames = ingredientes.map(ing => ing.nombre?.toLowerCase() || '');
    
    // Regla: Huevos solo en desayuno
    const hasEggs = ingredientNames.some(name => 
        name.includes('huevo') || name.includes('claras')
    );
    
    if (hasEggs && timeOfDay !== 'Desayuno') {
        violations.push('Huevos y claras solo permitidos en desayuno');
    }
    
    // Regla: No combinar aguacate + aceite de oliva
    const hasAvocado = ingredientNames.some(name => name.includes('aguacate'));
    const hasOliveOil = ingredientNames.some(name => name.includes('aceite de oliva'));
    
    if (hasAvocado && hasOliveOil) {
        violations.push('No se puede combinar aguacate con aceite de oliva');
    }
    
    // Regla: Jitomate máximo 2 cucharadas
    const tomatoIngredient = ingredientes.find(ing => 
        ing.nombre?.toLowerCase().includes('jitomate') || 
        ing.nombre?.toLowerCase().includes('tomate')
    );
    
    if (tomatoIngredient && tomatoIngredient.porcion) {
        const portion = tomatoIngredient.porcion.toLowerCase();
        if (!portion.includes('2 cucharadas') && !portion.includes('cucharada')) {
            violations.push('Jitomate debe ser máximo 2 cucharadas por comida');
        }
    }
    
    // Regla: Salmón no mezclar con otras grasas
    const hasSalmon = ingredientNames.some(name => name.includes('salmón'));
    if (hasSalmon) {
        const hasOtherFats = ingredientNames.some(name => 
            name.includes('aceite') || 
            name.includes('aguacate') || 
            name.includes('mantequilla')
        );
        
        if (hasOtherFats) {
            violations.push('Salmón no debe mezclarse con otras grasas');
        }
    }
    
    // Generar ingredientes corregidos
    let correctedIngredients;
    if (violations.length > 0) {
        correctedIngredients = correctCombinationViolations(ingredientes, violations, timeOfDay);
    }
    
    return {
        isValid: violations.length === 0,
        violations,
        correctedIngredients
    };
}

// Función auxiliar para corregir violaciones de combinación
function correctCombinationViolations(
    ingredientes: any[], 
    violations: string[], 
    timeOfDay: string
): any[] {
    let corrected = [...ingredientes];
    
    // Si hay huevos fuera del desayuno, removerlos
    if (timeOfDay !== 'Desayuno') {
        corrected = corrected.filter(ing => {
            const name = ing.nombre?.toLowerCase() || '';
            return !name.includes('huevo') && !name.includes('claras');
        });
    }
    
    // Si hay aguacate, remover aceite de oliva
    const hasAvocado = corrected.some(ing => ing.nombre?.toLowerCase().includes('aguacate'));
    if (hasAvocado) {
        corrected = corrected.filter(ing => 
            !ing.nombre?.toLowerCase().includes('aceite de oliva')
        );
    }
    
    // Corregir porción de jitomate
    corrected = corrected.map(ingredient => {
        if (ingredient.nombre?.toLowerCase().includes('jitomate') || 
            ingredient.nombre?.toLowerCase().includes('tomate')) {
            return {
                ...ingredient,
                porcion: "2 cucharadas"
            };
        }
        return ingredient;
    });
    
    // Si hay salmón, remover otras grasas
    const hasSalmon = corrected.some(ing => ing.nombre?.toLowerCase().includes('salmón'));
    if (hasSalmon) {
        corrected = corrected.filter(ing => {
            const name = ing.nombre?.toLowerCase() || '';
            return !name.includes('aceite') && 
                   !name.includes('aguacate') && 
                   !name.includes('mantequilla');
        });
    }
    
    return corrected;
}

// Función principal de validación (combina todas las reglas)
export function validateMealAgainstRules(
    mealName: string, 
    ingredientes: any[], 
    timeOfDay: string, 
    dietType: string, 
    objetivo: string,
    alimentos_evitar: string[]
): { isValid: boolean, violations: string[], correctedIngredients?: any[] } {
    
    // Validar por tipo de dieta
    const dietValidation = validateIngredientsByDiet(ingredientes, dietType, alimentos_evitar);
    
    // Validar reglas de combinación
    const combinationValidation = validateCombinationRules(mealName, ingredientes, timeOfDay);
    
    // Combinar resultados
    const allViolations = [...dietValidation.violations, ...combinationValidation.violations];
    
    // Usar los ingredientes más corregidos
    let finalCorrectedIngredients = ingredientes;
    
    if (dietValidation.correctedIngredients) {
        finalCorrectedIngredients = dietValidation.correctedIngredients;
    }
    
    if (combinationValidation.correctedIngredients) {
        finalCorrectedIngredients = combinationValidation.correctedIngredients;
    }
    
    return {
        isValid: allViolations.length === 0,
        violations: allViolations,
        correctedIngredients: allViolations.length > 0 ? finalCorrectedIngredients : undefined
    };
}