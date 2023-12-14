import { DataTypes } from "sequelize";
import db from "../db/connection";

const Planes_Alimenticios = db.define("planes_alimenticios", {
  nombre: {
    type: DataTypes.STRING,
  },
  resumen: {
    type: DataTypes.STRING,
  },
  descripcion_detallada: {
    type: DataTypes.STRING,
  },
  duracion: {
    type: DataTypes.STRING,
  },
  precio: {
    type: DataTypes.DECIMAL,
  },

});

export default Planes_Alimenticios;
