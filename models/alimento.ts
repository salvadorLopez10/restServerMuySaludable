import { DataTypes } from "sequelize";
import db from "../db/connection";

const Alimento = db.define("Alimento", {
  nombre: {
    type: DataTypes.STRING,
  },
  tipo: {
    type: DataTypes.STRING,
  },
  informacion_nutrimental: {
    type: DataTypes.STRING,
  },
});

export default Alimento;
