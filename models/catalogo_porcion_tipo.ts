import { DataTypes } from "sequelize";
import db from "../db/connection";

const Catalogo_Porcion_Tipos = db.define("catalogo_porcion_tipos", {
  nombre: {
    type: DataTypes.STRING,
  },
});

export default Catalogo_Porcion_Tipos;
