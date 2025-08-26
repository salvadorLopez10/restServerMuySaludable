import { Request, Response } from "express";
import ComidaDisponible from '../models/comida_disponible';
import { mealDataService } from '../services/mealDataService';

export const getComidasDisponibles = async (req: Request, res: Response) => {
    try {
        const comidas = await ComidaDisponible.findAll({
            where: { activo: true },
            order: [
                ['tipo_dieta', 'ASC'],
                ['objetivo', 'ASC'],
                ['tiempo_comida', 'ASC'],
                ['id', 'ASC']
            ]
        });

        res.json({
            status: "Ok",
            msg: "Comidas obtenidas",
            data: comidas
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getComidaDisponible = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const comida = await ComidaDisponible.findByPk(id);

        if (!comida) {
            return res.status(404).json({
                success: false,
                message: `No existe comida con id ${id}`
            });
        }

        res.json({
            status: "Ok",
            msg: "Comida obtenida",
            data: comida
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getComidasByDietAndObjective = async (req: Request, res: Response) => {
    const { tipo_dieta, objetivo } = req.params;

    try {
        const comidas = await mealDataService.getAvailableExactNames(tipo_dieta, objetivo);
        const stats = await mealDataService.getAvailableExactNames(tipo_dieta, objetivo);

        res.json({
            status: "Ok",
            msg: "Comidas filtradas obtenidas",
            data: {
                comidas,
                estadisticas: stats
            }
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const postComidaDisponible = async (req: Request, res: Response) => {
    const { nombre_exacto, tipo_dieta, objetivo, tiempo_comida } = req.body;

    try {
        const comida = await ComidaDisponible.create({
            nombre_exacto,
            tipo_dieta,
            objetivo,
            tiempo_comida
        });

        res.status(201).json({
            status: "Ok",
            msg: "Comida creada",
            data: comida
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const putComidaDisponible = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nombre_exacto, tipo_dieta, objetivo, tiempo_comida, activo } = req.body;

    try {
        const comida = await ComidaDisponible.findByPk(id);

        if (!comida) {
            return res.status(404).json({
                success: false,
                message: `No existe comida con id ${id}`
            });
        }

        await comida.update({
            nombre_exacto,
            tipo_dieta,
            objetivo,
            tiempo_comida,
            activo
        });

        res.json({
            status: "Ok",
            msg: "Comida actualizada",
            data: comida
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const deleteComidaDisponible = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const comida = await ComidaDisponible.findByPk(id);

        if (!comida) {
            return res.status(404).json({
                success: false,
                message: `No existe comida con id ${id}`
            });
        }

        await comida.update({ is_active: false });

        res.json({
            status: "Ok",
            msg: "Comida eliminada (soft delete)"
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};