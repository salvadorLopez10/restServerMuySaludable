import { DataTypes } from "sequelize";
import db from "../db/connection";

const Comida = db.define("Comida", {
  nombre: {
    type: DataTypes.STRING,
  },
  tipo: {
    type: DataTypes.STRING,
  }
});

export default Comida;
