import { DataTypes } from "sequelize";
import db from "../db/connection";

const Salud = db.define("config", {
  nombre: {
    type: DataTypes.STRING,
  },
  contenido: {
    type: DataTypes.TEXT,
  }
},{
    freezeTableName: true,
    tableName: "salud_financiera_mental"
}
);

export default Salud;
