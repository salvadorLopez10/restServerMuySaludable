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
  activo: {
    type: DataTypes.TINYINT,
  },
});

export default Carousel;
