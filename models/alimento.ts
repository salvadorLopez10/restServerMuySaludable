import { DataTypes } from "sequelize";
import db from "../db/connection";

const Alimento = db.define("alimento", {
  nombre: {
    type: DataTypes.STRING,
  },
  tipo_alimento: {
    type: DataTypes.STRING,
  },
  porcion: {
    type: DataTypes.STRING,
  },
  tipo_porcion: {
    type: DataTypes.STRING,
  },
  proteinas: {
    type: DataTypes.DECIMAL,
  },
  carbohidratos: {
    type: DataTypes.DECIMAL,
  },
  grasas: {
    type: DataTypes.DECIMAL,
  },
  calorias: {
    type: DataTypes.DECIMAL,
  },
  informacion_nutrimental: {
    type: DataTypes.STRING,
  },
});

export default Alimento;
