import OpenAI from 'openai';
import { NUTRITION_RULES } from '../config/nutritionRules';

export interface ValidationResult {
    esValido: boolean;
    errores: string[];
    advertencias: string[];
}

class ValidationService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY!,
        });
    }

    async validatePlanSection(
        planSection: any, 
        section: string, 
        exactMealNames: any,
        usedMeals: string[]
    ): Promise<ValidationResult> {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo",
                temperature: 0,
                messages: [
                    {
                        role: "system",
                        content: `Eres un validador experto de planes nutricionales. Analiza el plan y verifica:

NOMBRES EXACTOS PERMITIDOS:
${JSON.stringify(exactMealNames, null, 2)}

COMIDAS YA UTILIZADAS (no deben repetirse):
${usedMeals.join(', ')}

REGLAS A VALIDAR:
${NUTRITION_RULES}

Verifica especialmente:
1. Cada "nombre" debe ser EXACTAMENTE igual a uno de la lista permitida
2. No debe repetir comidas ya utilizadas
3. Debe cumplir reglas nutricionales básicas

Responde SOLO con este formato JSON:
{
    "esValido": boolean,
    "errores": ["lista de errores específicos"],
    "advertencias": ["lista de advertencias menores"]
}`
                    },
                    {
                        role: "user",
                        content: `Valida esta sección "${section}": ${JSON.stringify(planSection, null, 2)}`
                    }
                ]
            });

            const result = response.choices[0]?.message?.content;
            if (!result) {
                return { esValido: false, errores: ["No se recibió respuesta de validación"], advertencias: [] };
            }

            return JSON.parse(result);
        } catch (error:any) {
            console.error('Error en validación:', error);
            return { 
                esValido: false, 
                errores: [`Error procesando validación: ${error.message}`], 
                advertencias: [] 
            };
        }
    }

    async correctPlanSection(
        planSection: any,
        validationErrors: string[],
        exactMealNames: any,
        usedMeals: string[]
    ): Promise<string> {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo",
                temperature: 0.2,
                messages: [
                    {
                        role: "system",
                        content: `Eres un corrector de planes nutricionales. Corrige el plan manteniendo la estructura pero solucionando los errores.

NOMBRES EXACTOS PERMITIDOS: ${JSON.stringify(exactMealNames, null, 2)}
COMIDAS YA USADAS (no repetir): ${usedMeals.join(', ')}

ERRORES A CORREGIR: ${validationErrors.join(', ')}

Mantén la misma estructura JSON pero corrige solo las partes con errores.
USA ÚNICAMENTE nombres de la lista permitida.
Responde SOLO con el JSON corregido.`
                    },
                    {
                        role: "user",
                        content: `Corrige este plan: ${JSON.stringify(planSection, null, 2)}`
                    }
                ]
            });

            return response.choices[0]?.message?.content || '';
        } catch (error) {
            console.error('Error en corrección:', error);
            throw error;
        }
    }
}

export const validationService = new ValidationService();