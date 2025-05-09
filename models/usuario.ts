import { DataTypes } from "sequelize";
import db from "../db/connection";

const Usuario = db.define('usuario',{
    nombre: {
        type: DataTypes.STRING
    },
    email: {
        type: DataTypes.STRING
    },
    telefono: {
        type: DataTypes.STRING
    },
    password: {
        type: DataTypes.STRING
    },

    fecha_nacimiento: {
        type: DataTypes.STRING
    },

    edad: {
        type: DataTypes.STRING
    },
    altura: {
        type: DataTypes.STRING
    },
    peso: {
        type: DataTypes.STRING
    },
    sexo: {
        type: DataTypes.STRING
    },
    actividad_fisica: {
        type: DataTypes.STRING
    },
    tipo_dieta: {
        type: DataTypes.STRING
    },
    alimentos_evitar: {
        type: DataTypes.STRING
    },
    alimentos_preferencia: {
        type: DataTypes.STRING
    },
    objetivo: {
        type: DataTypes.STRING
    },
    social_media: {
        type: DataTypes.STRING
    },
    estado_mexico: {
        type: DataTypes.STRING
    },
    tmb: {
        type: DataTypes.STRING
    },
    deleted: {
        type: DataTypes.BOOLEAN
    },
    notification_token: {
        type: DataTypes.STRING
    }
});

export default Usuario;
