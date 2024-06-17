import { DataTypes } from "sequelize";
import db from "../db/connection";

const Alimentos_Comida = db.define("alimentos_comida", {
  id_comida: {
    type: DataTypes.INTEGER,
  },
  id_alimento: {
    type: DataTypes.INTEGER,
  },
  cantidad: {
    type: DataTypes.INTEGER,
  },
  tipo_porcion: {
    type: DataTypes.STRING,
  },
  descripcion: {
    type: DataTypes.STRING,
  },
  id_catalogo_porcion_tipos: {
    type: DataTypes.INTEGER,
  },
});

export default Alimentos_Comida;