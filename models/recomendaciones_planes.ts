import { DataTypes } from "sequelize";
import db from "../db/connection";

const Recomendaciones = db.define("recomendaciones_planes", {
  objetivo: {
    type: DataTypes.STRING,
  },
   titulo: {
    type: DataTypes.STRING,
  },
   descripcion: {
    type: DataTypes.STRING,
  },
  image_url: {
    type: DataTypes.STRING,
  },
  orden: {
    type: DataTypes.INTEGER,
  },
  visible: {
    type: DataTypes.TINYINT,
  },
});

export default Recomendaciones;
