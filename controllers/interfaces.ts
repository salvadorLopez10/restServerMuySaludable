export interface Meal {
    idComida: number;
    nombreComida: string;
    tipo: string;
    categoria: string;
    idIngrediente: number;
    nombreIngrediente: string;
    porcionBase: string;
    tipoPorcion: string;
    caloriasBase: string;
    detox:string;
}

export interface Ingredient {
    nombre: string;
    porcionBase: string;
    tipoPorcion: string;
    caloriasPorcionBase: string;
    porcionAjustada?: number;
    caloriasAjustadas?: number;
}

export interface MealGroup {
    tipo: string;
    ingredientes: Ingredient[];
    nombre: string;
    idComida: number;
    caloriasTotalesAjustadas?: number;
    caloriasTotales?: number | undefined;
    detox: number;
}

export interface MealPlan {
    Desayunos: MealGroup[];
    Colaciones: MealGroup[];
    Comidas: MealGroup[];
    Cenas: MealGroup[];
}

export type TipoComida = 'Desayuno' | 'Colacion1' | 'Comida' | 'Colacion2' | 'Cena';


export interface JSONResponse {
    Detox: {
        [key in TipoComida]: {
            [key: string]: {
                nombre: string;
                ingredientes: {
                    nombre: string;
                    porcion: string;
                }[];
            }
        };
    };
    Mes1: {
        [key in TipoComida]: {
            [key: string]: {
                nombre: string;
                ingredientes: {
                    nombre: string;
                    porcion: string;
                }[];
            }
        };
    };
    Mes2: {
        [key in TipoComida]: {
            [key: string]: {
                nombre: string;
                ingredientes: {
                    nombre: string;
                    porcion: string;
                }[];
            }
        };
    };
}