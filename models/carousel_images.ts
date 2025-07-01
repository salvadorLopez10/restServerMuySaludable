import { DataTypes } from "sequelize";
import db from "../db/connection";

const Carousel = db.define("carousel_images", {
  titulo: {
    type: DataTypes.STRING,
  },
  image_url: {
    type: DataTypes.STRING,
  },
  tipo: {
    type: DataTypes.STRING,
  },
  vigente_fecha_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  vigente_fecha_fin: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  activo: {
    type: DataTypes.TINYINT,
  },
});

export default Carousel;
