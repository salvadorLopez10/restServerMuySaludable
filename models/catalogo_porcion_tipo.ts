import { DataTypes } from "sequelize";
import db from "../db/connection";

const Catalogo_Porcion_Tipos = db.define("Catalogo_Porcion_Tipos", {
  nombre: {
    type: DataTypes.STRING,
  },
});

export default Catalogo_Porcion_Tipos;
