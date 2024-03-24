import { DataTypes } from "sequelize";
import db from "../db/connection";

const Codigo = db.define("codigos_descuento", {
  nombre: {
    type: DataTypes.STRING,
  },
  valor: {
    type: DataTypes.INTEGER,
  },
  vigencia: {
    type: DataTypes.DATE,
  },
  activo:{
    type: DataTypes.TINYINT,
  }
});

export default Codigo;
