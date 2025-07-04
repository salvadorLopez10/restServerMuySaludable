import { DataTypes } from "sequelize";
import db from "../db/connection";

const Salud = db.define("config", {
  nombre: {
    type: DataTypes.STRING,
  },
  contenido: {
    type: DataTypes.TEXT,
  },
  vigente_fecha_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  vigente_fecha_fin: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
},{
    freezeTableName: true,
    tableName: "salud_financiera_mental"
}
);

export default Salud;
