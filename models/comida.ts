import { DataTypes } from "sequelize";
import db from "../db/connection";

const Comida = db.define("comida", {
  nombre: {
    type: DataTypes.STRING,
  },
  tipo: {
    type: DataTypes.STRING,
  },
  categoria: {
    type: DataTypes.STRING,
  },
  calorias: {
    type: DataTypes.STRING,
  },
  descripcion: {
    type: DataTypes.STRING,
  },
  detox: {
    type: DataTypes.TINYINT,
  }
});

export default Comida;