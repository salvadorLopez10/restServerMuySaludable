import { QueryTypes, Op } from 'sequelize';
import db from '../db/connection';
import ComidaDisponible from '../models/comida_disponible';

interface MealsByTime {
    [key: string]: string[];
}

class MealDataService {
    
    // Obtener nombres exactos de comidas disponibles
    async getExactMealNames(tipoDieta: string, objetivo: string): Promise<MealsByTime> {
        try {
            const comidas = await ComidaDisponible.findAll({
                where: {
                    tipo_dieta: tipoDieta,
                    objetivo: objetivo,
                    activo: true
                },
                attributes: ['nombre_exacto', 'tiempo_comida'],
                order: [
                    ['tiempo_comida', 'ASC'],
                    ['id', 'ASC']
                ]
            });

            // Agrupar por tiempo de comida
            const grouped: MealsByTime = {
                'Desayuno': [],
                'Comida': [],
                'Colación': [],
                'Cena': []
            };

            comidas.forEach((comida: any) => {
                grouped[comida.tiempo_comida].push(comida.nombre_exacto);
            });

            console.log(`✅ Nombres exactos cargados para ${tipoDieta} - ${objetivo}:`, {
                Desayuno: grouped.Desayuno.length,
                Comida: grouped.Comida.length,
                Colación: grouped.Colación.length,
                Cena: grouped.Cena.length
            });

            return grouped;

        } catch (error: any) {
            console.error('❌ Error obteniendo nombres exactos:', error);
            throw new Error(`Error cargando comidas: ${error.message}`);
        }
    }

    // Obtener nombres exactos excluyendo los ya usados
    async getAvailableExactNames(
        tipoDieta: string, 
        objetivo: string, 
        excludeNames: string[] = [],
        allowReuse: boolean = false
    ): Promise<MealsByTime> {
        try {
            const whereClause: any = {
                tipo_dieta: tipoDieta,
                objetivo: objetivo,
                activo: true
            };

            // Solo excluir si no estamos en modo reuso
            if (excludeNames.length > 0 && !allowReuse) {
                whereClause.nombre_exacto = {
                    [Op.notIn]: excludeNames
                };
            }

            const comidas = await ComidaDisponible.findAll({
                where: whereClause,
                attributes: ['nombre_exacto', 'tiempo_comida'],
                order: [
                    ['tiempo_comida', 'ASC'],
                    ['id', 'ASC']
                ]
            });

            const grouped: MealsByTime = {
                'Desayuno': [],
                'Comida': [],
                'Colación': [],
                'Cena': []
            };

            comidas.forEach((comida: any) => {
                grouped[comida.tiempo_comida].push(comida.nombre_exacto);
            });

            // Si algún tiempo tiene menos de 3 opciones y no estamos en modo reuso, activarlo
            for (const timeOfDay in grouped) {
                if (grouped[timeOfDay].length < 3 && !allowReuse) {
                    console.log(`⚠️ Pocas opciones para ${timeOfDay} (${grouped[timeOfDay].length}), permitiendo reutilización`);
                    return this.getAvailableExactNames(tipoDieta, objetivo, [], true);
                }
            }

            console.log(`📊 Comidas encontradas para ${tipoDieta} - ${objetivo}:`, {
                Desayuno: grouped.Desayuno.length,
                Comida: grouped.Comida.length,
                Colación: grouped.Colación.length,
                Cena: grouped.Cena.length,
                allowReuse: allowReuse
            });

            return grouped;

        } catch (error) {
            console.error('❌ Error obteniendo nombres disponibles:', error);
            throw error;
        }
    }

    // Verificar si una comida existe
    async mealExists(nombre: string, tipoDieta: string, objetivo: string): Promise<boolean> {
        try {
            const count = await ComidaDisponible.count({
                where: {
                    nombre_exacto: nombre,
                    tipo_dieta: tipoDieta,
                    objetivo: objetivo,
                    activo: true
                }
            });

            return count > 0;
        } catch (error) {
            console.error('❌ Error verificando existencia de comida:', error);
            return false;
        }
    }

    // Obtener estadísticas
    async getMealStats(tipoDieta: string, objetivo: string): Promise<any> {
        try {
            const stats = await ComidaDisponible.findAll({
                where: {
                    tipo_dieta: tipoDieta,
                    objetivo: objetivo,
                    activo: true
                },
                attributes: [
                    'tiempo_comida',
                    [db.Sequelize.fn('COUNT', '*'), 'cantidad']
                ],
                group: ['tiempo_comida']
            });

            return stats;
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            throw error;
        }
    }
}

export const mealDataService = new MealDataService();