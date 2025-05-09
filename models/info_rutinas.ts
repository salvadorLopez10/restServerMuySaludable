import { DataTypes } from "sequelize";
import db from "../db/connection";

const InfoRutinas = db.define("info_rutinas", {
  titulo: {
    type: DataTypes.STRING,
  },
  dias: {
    type: DataTypes.STRING,
  },
  descripcion: {
    type: DataTypes.STRING,
  },
  video_url: {
    type: DataTypes.STRING,
  },
  image_url: {
    type: DataTypes.STRING,
  },
  nivel: {
    type: DataTypes.STRING,
  },
  activo: {
    type: DataTypes.TINYINT,
  },
});

export default InfoRutinas;
