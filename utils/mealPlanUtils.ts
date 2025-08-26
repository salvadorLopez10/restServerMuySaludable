export function extractJsonFromMarkdown(content: string): string {
    let cleaned = content.trim();
    
    console.log('🧹 Limpiando contenido (primeros 100 chars):', cleaned.substring(0, 100));
    
    // Remover todos los tipos de markdown (usando regex para evitar problemas con backticks)
    cleaned = cleaned.replace(/```json\s*/gi, '');
    cleaned = cleaned.replace(/```\s*/g, '');
    cleaned = cleaned.replace(/^json\s*/gi, '');
    
    // Remover cualquier texto antes del primer {
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace > 0) {
        cleaned = cleaned.substring(firstBrace);
        console.log('🔧 Removido texto antes del JSON');
    }
    
    // Remover cualquier texto después del último }
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
        cleaned = cleaned.substring(0, lastBrace + 1);
        console.log('🔧 Removido texto después del JSON');
    }
    
    // Si no empieza con { o no termina con }, intentar extraer JSON válido
    if (!cleaned.startsWith('{') || !cleaned.endsWith('}')) {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
            console.log('🔧 Extraído JSON usando regex');
        }
    }
    
    console.log('✅ Contenido limpio (primeros 100 chars):', cleaned.substring(0, 100));
    return cleaned.trim();
}

export function extractMealNames(sectionData: any): string[] {
    const mealNames: string[] = [];
    
    try {
        for (const [timeOfDay, options] of Object.entries(sectionData)) {
            if (timeOfDay === 'Hidratación') continue;
            
            if (options && typeof options === 'object') {
                for (const meal of Object.values(options)) {
                    // Cast explícito y verificación segura
                    const mealObj = meal as any;
                    if (mealObj?.nombre && typeof mealObj.nombre === 'string') {
                        mealNames.push(mealObj.nombre);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error extrayendo nombres de comidas:', error);
    }
    
    return mealNames;
}