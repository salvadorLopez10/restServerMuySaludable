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
    nombre: string;
    idComida: number;
    ingredientes: Ingredient[];
    caloriasTotales?: number;
}

export interface MealPlan {
    Desayunos: MealGroup[];
    Colaciones: MealGroup[];
    Comidas: MealGroup[];
    Cenas: MealGroup[];
}