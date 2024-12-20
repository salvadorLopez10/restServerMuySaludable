import { DataTypes } from "sequelize";
import db from "../db/connection";

const Suscripcion = db.define("suscripciones", {
  id_usuario: {
    type: DataTypes.INTEGER,
  },
  id_plan_alimenticio: {
    type: DataTypes.INTEGER,
  },
  id_pago:{
    type: DataTypes.STRING,
  },
  fecha_expiracion: {
    type: DataTypes.DATE,
  },
  //Activo, Vencido, Cancelado
  estado:{
    type: DataTypes.STRING,
  },
  fecha_compra: {
    type: DataTypes.DATE,
  },

});

export default Suscripcion;
