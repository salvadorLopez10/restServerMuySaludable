import { DataTypes } from "sequelize";
import db from "../db/connection";

const Alimentos_Comida = db.define("Alimentos_Comida", {
  id_comida: {
    type: DataTypes.INTEGER,
  },
  id_alimento: {
    type: DataTypes.INTEGER,
  },
  cantidad: {
    type: DataTypes.INTEGER,
  },
  id_catalogo_porcion_tipos: {
    type: DataTypes.INTEGER,
  },
});

export default Alimentos_Comida;