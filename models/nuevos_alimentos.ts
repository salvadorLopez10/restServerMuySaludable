import { DataTypes } from "sequelize";
import db from "../db/connection";

const NuevoAlimento = db.define("nuevos_alimento", {
  nombre: {
    type: DataTypes.STRING,
  },
  grupo: {
    type: DataTypes.STRING,
  },
  equivalente: {
    type: DataTypes.DECIMAL,
  },
  unidad_medida: {
    type: DataTypes.STRING,
  },
  proteinas: {
    type: DataTypes.DECIMAL,
  },
  lipidos: {
    type: DataTypes.DECIMAL,
  },
  hco: {
    type: DataTypes.DECIMAL,
  },
  kcal: {
    type: DataTypes.DECIMAL,
  },
  tiempo_comida: {
    type: DataTypes.STRING,
  },
  categoria: {
    type: DataTypes.STRING,
  },
});

export default NuevoAlimento;
