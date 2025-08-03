import { DataTypes } from "sequelize";
import db from "../db/connection";

const ComidaDisponible = db.define("comidas_disponibles", {
  nombre_exacto: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tipo_dieta: {
    type: DataTypes.STRING,
    allowNull: false
  },
  objetivo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tiempo_comida: {
    type: DataTypes.STRING,
    allowNull: false
  },
  activo: {
    type: DataTypes.TINYINT,
    defaultValue: 1, // Por defecto, las comidas están activas
  },
});

export default ComidaDisponible;
