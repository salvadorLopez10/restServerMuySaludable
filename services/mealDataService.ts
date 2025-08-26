import { Op, fn, col, where } from 'sequelize';
import ComidaDisponible from '../models/comida_disponible';

class MealDataService {

    // Función principal para obtener comidas disponibles
    async getAvailableExactNames(
        dietType: string, 
        objetivo: string, 
        excludeMeals: string[] = [], 
        allowReuse: boolean = false
    ): Promise<any> {
        try {
            console.log(`🔍 Buscando comidas para dieta: ${dietType}, objetivo: ${objetivo}`);
            console.log(`🚫 Excluyendo: ${excludeMeals.join(', ')}`);
            console.log(`🔄 Reutilización permitida: ${allowReuse}`);

            // Construir condiciones WHERE
            const whereConditions: any = {
                tipo_dieta: dietType,
                objetivo: objetivo,
                activo: 1
            };

            // Si no se permite reutilización, excluir las comidas ya usadas
            if (!allowReuse && excludeMeals.length > 0) {
                whereConditions.nombre_exacto = {
                    [Op.notIn]: excludeMeals
                };
            }

            const results = await ComidaDisponible.findAll({
                where: whereConditions,
                order: [['tiempo_comida', 'ASC'], ['nombre_exacto', 'ASC']]
            });

            if (!results || results.length === 0) {
                console.log(`⚠️ No se encontraron comidas para dieta: ${dietType}, objetivo: ${objetivo}`);
                return this.getEmptyMealStructure();
            }

            console.log(`📊 Total de comidas encontradas: ${results.length}`);

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
                console.log(`📋 ${time}: ${(meals as string[]).length} comidas disponibles`);
            }

            // Verificar si algún tiempo tiene muy pocas opciones
            const minMealsNeeded = 3;
            let needsReuse = false;

            for (const [time, meals] of Object.entries(mealsByTime)) {
                if ((meals as string[]).length < minMealsNeeded) {
                    console.log(`⚠️ ${time} tiene solo ${(meals as string[]).length} comidas, menos del mínimo requerido (${minMealsNeeded})`);
                    needsReuse = true;
                }
            }

            // Si algún tiempo necesita más opciones y no se permite reutilización, volver a consultar
            if (needsReuse && !allowReuse) {
                console.log(`🔄 Reconsultando con reutilización permitida debido a pocas opciones...`);
                return this.getAvailableExactNames(dietType, objetivo, [], true);
            }

            // Si después de permitir reutilización aún hay tiempos vacíos, rellenar con básicos
            for (const [time, meals] of Object.entries(mealsByTime)) {
                if ((meals as string[]).length === 0) {
                    console.log(`🆘 ${time} sigue vacío, agregando comidas básicas...`);
                    mealsByTime[time] = this.getBasicMealsForTime(time);
                }
            }

            return mealsByTime;

        } catch (error) {
            console.error('❌ Error en getAvailableExactNames:', error);
            return this.getEmptyMealStructure();
        }
    }

    // Obtener todas las comidas disponibles (sin filtros)
    async getAllMeals(): Promise<any[]> {
        try {
            const results = await ComidaDisponible.findAll({
                where: {
                    activo: 1
                },
                order: [['tipo_dieta', 'ASC'], ['objetivo', 'ASC'], ['tiempo_comida', 'ASC'], ['nombre_exacto', 'ASC']]
            });

            return results.map(meal => meal.toJSON());
        } catch (error) {
            console.error('Error obteniendo todas las comidas:', error);
            return [];
        }
    }

    // Obtener comidas por tipo de dieta
    async getMealsByDiet(dietType: string): Promise<any[]> {
        try {
            const results = await ComidaDisponible.findAll({
                where: {
                    tipo_dieta: dietType,
                    activo: 1
                },
                order: [['objetivo', 'ASC'], ['tiempo_comida', 'ASC'], ['nombre_exacto', 'ASC']]
            });

            return results.map(meal => meal.toJSON());
        } catch (error) {
            console.error(`Error obteniendo comidas para dieta ${dietType}:`, error);
            return [];
        }
    }

    // Obtener comidas por objetivo
    async getMealsByObjective(objetivo: string): Promise<any[]> {
        try {
            const results = await ComidaDisponible.findAll({
                where: {
                    objetivo: objetivo,
                    activo: 1
                },
                order: [['tipo_dieta', 'ASC'], ['tiempo_comida', 'ASC'], ['nombre_exacto', 'ASC']]
            });

            return results.map(meal => meal.toJSON());
        } catch (error) {
            console.error(`Error obteniendo comidas para objetivo ${objetivo}:`, error);
            return [];
        }
    }

    // Obtener comidas por tiempo de comida
    async getMealsByTime(timeOfDay: string): Promise<any[]> {
        try {
            const results = await ComidaDisponible.findAll({
                where: {
                    tiempo_comida: timeOfDay,
                    activo: 1
                },
                order: [['tipo_dieta', 'ASC'], ['objetivo', 'ASC'], ['nombre_exacto', 'ASC']]
            });

            return results.map(meal => meal.toJSON());
        } catch (error) {
            console.error(`Error obteniendo comidas para tiempo ${timeOfDay}:`, error);
            return [];
        }
    }

    // Buscar comidas por nombre (búsqueda flexible)
    async searchMealsByName(searchTerm: string): Promise<any[]> {
        try {
            const results = await ComidaDisponible.findAll({
                where: {
                    nombre_exacto: {
                        [Op.like]: `%${searchTerm}%`
                    },
                    activo: 1
                },
                order: [['tipo_dieta', 'ASC'], ['objetivo', 'ASC'], ['tiempo_comida', 'ASC'], ['nombre_exacto', 'ASC']]
            });

            return results.map(meal => meal.toJSON());
        } catch (error) {
            console.error(`Error buscando comidas con término ${searchTerm}:`, error);
            return [];
        }
    }

    // Verificar si una comida específica existe
    async mealExists(mealName: string, dietType: string, objetivo: string, timeOfDay: string): Promise<boolean> {
        try {
            const meal = await ComidaDisponible.findOne({
                where: {
                    nombre_exacto: mealName,
                    tipo_dieta: dietType,
                    objetivo: objetivo,
                    tiempo_comida: timeOfDay,
                    activo: 1
                }
            });

            return meal !== null;
        } catch (error) {
            console.error('Error verificando existencia de comida:', error);
            return false;
        }
    }

    // Crear nueva comida disponible
    async createMeal(mealData: {
        nombre_exacto: string,
        tipo_dieta: string,
        objetivo: string,
        tiempo_comida: string
    }): Promise<any> {
        try {
            const newMeal = await ComidaDisponible.create(mealData);
            return newMeal.toJSON();
        } catch (error) {
            console.error('Error creando nueva comida:', error);
            throw error;
        }
    }

    // Actualizar comida existente
    async updateMeal(id: number, updates: Partial<{
        nombre_exacto: string,
        tipo_dieta: string,
        objetivo: string,
        tiempo_comida: string,
        activo: number
    }>): Promise<boolean> {
        try {
            const [updatedRows] = await ComidaDisponible.update(updates, {
                where: { id }
            });

            return updatedRows > 0;
        } catch (error) {
            console.error('Error actualizando comida:', error);
            return false;
        }
    }

    // Eliminar comida (soft delete - marcar como inactiva)
    async deleteMeal(id: number): Promise<boolean> {
        try {
            const [updatedRows] = await ComidaDisponible.update(
                { activo: 0 },
                { where: { id } }
            );

            return updatedRows > 0;
        } catch (error) {
            console.error('Error eliminando comida:', error);
            return false;
        }
    }

    // Reactivar comida
    async reactivateMeal(id: number): Promise<boolean> {
        try {
            const [updatedRows] = await ComidaDisponible.update(
                { activo: 1 },
                { where: { id } }
            );

            return updatedRows > 0;
        } catch (error) {
            console.error('Error reactivando comida:', error);
            return false;
        }
    }

    // Obtener estadísticas de comidas
    async getMealStatistics(): Promise<any> {
        try {
            // Total de comidas activas
            const totalActive = await ComidaDisponible.count({
                where: { activo: 1 }
            });

            // Total de comidas inactivas
            const totalInactive = await ComidaDisponible.count({
                where: { activo: 0 }
            });

            // Comidas por tipo de dieta
            const byDiet = await ComidaDisponible.findAll({
                attributes: [
                    'tipo_dieta',
                    [fn('COUNT', '*'), 'count']
                ],
                where: { activo: 1 },
                group: ['tipo_dieta']
            });

            // Comidas por objetivo
            const byObjective = await ComidaDisponible.findAll({
                attributes: [
                    'objetivo',
                    [fn('COUNT', '*'), 'count']
                ],
                where: { activo: 1 },
                group: ['objetivo']
            });

            // Comidas por tiempo
            const byTime = await ComidaDisponible.findAll({
                attributes: [
                    'tiempo_comida',
                    [fn('COUNT', '*'), 'count']
                ],
                where: { activo: 1 },
                group: ['tiempo_comida']
            });

            return {
                totalActive,
                totalInactive,
                total: totalActive + totalInactive,
                byDiet: byDiet.map(item => item.toJSON()),
                byObjective: byObjective.map(item => item.toJSON()),
                byTime: byTime.map(item => item.toJSON())
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            return {
                totalActive: 0,
                totalInactive: 0,
                total: 0,
                byDiet: [],
                byObjective: [],
                byTime: []
            };
        }
    }

    // Validar que una comida cumple con criterios específicos
    async validateMealCriteria(mealName: string, criteria: {
        dietType?: string,
        objetivo?: string,
        timeOfDay?: string,
        excludeIngredients?: string[]
    }): Promise<{ isValid: boolean, reasons: string[] }> {
        const reasons: string[] = [];

        try {
            // Verificar si la comida existe en la base de datos
            const whereConditions: any = {
                nombre_exacto: mealName,
                activo: 1
            };

            if (criteria.dietType) {
                whereConditions.tipo_dieta = criteria.dietType;
            }

            if (criteria.objetivo) {
                whereConditions.objetivo = criteria.objetivo;
            }

            if (criteria.timeOfDay) {
                whereConditions.tiempo_comida = criteria.timeOfDay;
            }

            const meal = await ComidaDisponible.findOne({
                where: whereConditions
            });

            if (!meal) {
                reasons.push('La comida no existe en la base de datos con los criterios especificados');
                return { isValid: false, reasons };
            }

            // Aquí podrías agregar más validaciones específicas
            // Por ejemplo, validar ingredientes prohibidos si tienes esa información

            return { isValid: reasons.length === 0, reasons };

        } catch (error) {
            console.error('Error validando criterios de comida:', error);
            reasons.push('Error interno al validar la comida');
            return { isValid: false, reasons };
        }
    }

    // Obtener comidas duplicadas (mismo nombre, dieta, objetivo, tiempo)
    async getDuplicateMeals(): Promise<any[]> {
        try {
            const duplicates = await ComidaDisponible.findAll({
                attributes: [
                    'nombre_exacto',
                    'tipo_dieta',
                    'objetivo',
                    'tiempo_comida',
                    [fn('COUNT', '*'), 'count']
                ],
                where: { activo: 1 },
                group: ['nombre_exacto', 'tipo_dieta', 'objetivo', 'tiempo_comida'],
                having: where(fn('COUNT', '*'), '>', 1)
            });

            return duplicates.map(item => item.toJSON());
        } catch (error) {
            console.error('Error obteniendo comidas duplicadas:', error);
            return [];
        }
    }

    // Función auxiliar: estructura vacía por defecto
    private getEmptyMealStructure(): any {
        return {
            'Desayuno': this.getBasicMealsForTime('Desayuno'),
            'Comida': this.getBasicMealsForTime('Comida'),
            'Colación': this.getBasicMealsForTime('Colación'),
            'Cena': this.getBasicMealsForTime('Cena')
        };
    }

    // Función auxiliar: comidas básicas por tiempo
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

    // Bulk operations
    async createMultipleMeals(mealsData: Array<{
        nombre_exacto: string,
        tipo_dieta: string,
        objetivo: string,
        tiempo_comida: string
    }>): Promise<any[]> {
        try {
            const newMeals = await ComidaDisponible.bulkCreate(mealsData);
            return newMeals.map(meal => meal.toJSON());
        } catch (error) {
            console.error('Error creando múltiples comidas:', error);
            throw error;
        }
    }

    // Verificar integridad de datos
    async checkDataIntegrity(): Promise<{
        isValid: boolean,
        issues: string[],
        recommendations: string[]
    }> {
        const issues: string[] = [];
        const recommendations: string[] = [];

        try {
            // Verificar comidas sin nombre
            const mealsWithoutName = await ComidaDisponible.count({
                where: {
                    [Op.or]: [
                        { nombre_exacto: null },
                        { nombre_exacto: '' }
                    ],
                    activo: 1
                }
            });

            if (mealsWithoutName > 0) {
                issues.push(`${mealsWithoutName} comidas activas sin nombre`);
                recommendations.push('Revisar y completar nombres de comidas faltantes');
            }

            // Verificar distribución por tiempo de comida
            const timeDistribution = await ComidaDisponible.findAll({
                attributes: [
                    'tiempo_comida',
                    [fn('COUNT', '*'), 'count']
                ],
                where: { activo: 1 },
                group: ['tiempo_comida']
            });

            const timeStats = timeDistribution.reduce((acc: any, item: any) => {
                const data = item.toJSON();
                acc[data.tiempo_comida] = parseInt(data.count);
                return acc;
            }, {});

            const requiredTimes = ['Desayuno', 'Comida', 'Colación', 'Cena'];
            for (const time of requiredTimes) {
                const count = timeStats[time] || 0;
                if (count < 3) {
                    issues.push(`Solo ${count} comidas disponibles para ${time} (mínimo recomendado: 3)`);
                    recommendations.push(`Agregar más opciones para ${time}`);
                }
            }

            // Verificar duplicados exactos
            const duplicates = await this.getDuplicateMeals();
            if (duplicates.length > 0) {
                issues.push(`${duplicates.length} grupos de comidas duplicadas encontrados`);
                recommendations.push('Eliminar o consolidar comidas duplicadas');
            }

            return {
                isValid: issues.length === 0,
                issues,
                recommendations
            };

        } catch (error) {
            console.error('Error verificando integridad de datos:', error);
            return {
                isValid: false,
                issues: ['Error interno al verificar integridad de datos'],
                recommendations: ['Contactar soporte técnico']
            };
        }
    }
}

export const mealDataService = new MealDataService();
export default mealDataService;