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
                        content: `Valida el plan nutricional con estas reglas:

NOMBRES PERMITIDOS:
${JSON.stringify(exactMealNames, null, 2)}

COMIDAS YA UTILIZADAS: ${usedMeals.join(', ')}

REGLAS A VALIDAR:
${NUTRITION_RULES}

CLASIFICACIÓN DE ERRORES:
- CRÍTICO: Nombres completamente inventados, estructura malformada
- MENOR: Repeticiones dentro de la sección, combinaciones cuestionables, nombres similares pero no exactos

Responde con:
{
    "esValido": boolean (true si NO hay errores críticos),
    "errores": ["solo errores CRÍTICOS que impiden usar el plan"],
    "advertencias": ["errores menores, repeticiones, nombres similares"]
}

Un plan es VÁLIDO si no tiene errores críticos, aunque tenga errores menores.`
                    },
                    {
                        role: "user",
                        content: `Valida: ${JSON.stringify(planSection, null, 2)}`
                    }
                ]
            });

            const result = response.choices[0]?.message?.content;
            if (!result) {
                return { esValido: true, errores: [], advertencias: ["No se pudo validar, aceptando plan"] };
            }

            return JSON.parse(result);
        } catch (error: any) {
            console.error('Error en validación:', error);
            return { 
                esValido: true, // En caso de error, aceptar el plan
                errores: [], 
                advertencias: [`Error en validación: ${error.message}`] 
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
                        content: `Corrige el plan manteniendo la estructura pero solucionando errores menores.

NOMBRES PERMITIDOS: ${JSON.stringify(exactMealNames, null, 2)}
COMIDAS YA USADAS: ${usedMeals.join(', ')}

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