interface MealOption {
    nombre: string;
    ingredientes?: Array<{
        nombre: string;
        porcion: string;
    }>;
    preparacion?: string;
}

interface MealTime {
    [optionKey: string]: MealOption;
}

interface SectionData {
    [timeOfDay: string]: MealTime | { recomendaciones: string };
}


export function extractJsonFromMarkdown(content: string): string {
    let cleaned = content.trim();
    
    // Remover markdown básico
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
    }
    
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    
    // Limpiar markdown que aparece en el medio
    cleaned = cleaned.replace(/```json\s*/g, '');
    cleaned = cleaned.replace(/```\s*/g, '');
    
    // NUEVO: Buscar el JSON válido más grande en el contenido
    const jsonMatches = cleaned.match(/\{[\s\S]*?\}(?=\s*$|\s*```|\s*\n\s*```)/);
    if (jsonMatches) {
        cleaned = jsonMatches[0];
    }
    
    // NUEVO: Limpiar caracteres extraños al inicio y final
    cleaned = cleaned.replace(/^[^{]*/, ''); // Remover todo antes del primer {
    cleaned = cleaned.replace(/[^}]*$/, ''); // Remover todo después del último }
    
    return cleaned.trim();
}

export function extractMealNames(sectionData: SectionData): string[] {
    const mealNames: string[] = [];
    
    for (const [timeOfDay, options] of Object.entries(sectionData)) {
        if (timeOfDay === 'Hidratación') continue;
        
        // Verificar que options tenga la estructura correcta
        if (options && typeof options === 'object' && !('recomendaciones' in options)) {
            const mealTime = options as MealTime;
            for (const meal of Object.values(mealTime)) {
                if (meal?.nombre) {
                    mealNames.push(meal.nombre);
                }
            }
        }
    }
    
    return mealNames;

}