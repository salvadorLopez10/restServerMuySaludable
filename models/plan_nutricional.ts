import { DataTypes } from "sequelize";
import db from "../db/connection";

const Plan_Nutricional = db.define("plan_nutricional", {
    nombre: {
      type: DataTypes.STRING,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
    },
    contenido: {
      type: DataTypes.TEXT,
    },
    activo: {
      type: DataTypes.TINYINT,
    },
  },{
    freezeTableName: true,
    tableName: "plan_nutricional"
  }
);

export default Plan_Nutricional;