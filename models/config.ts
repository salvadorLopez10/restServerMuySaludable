import { DataTypes } from "sequelize";
import db from "../db/connection";

const Config = db.define("config", {
  nombre: {
    type: DataTypes.STRING,
  },
  valor: {
    type: DataTypes.STRING,
  }
},{
    freezeTableName: true,
    tableName: "config"
}
);

export default Config;
