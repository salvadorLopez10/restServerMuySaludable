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