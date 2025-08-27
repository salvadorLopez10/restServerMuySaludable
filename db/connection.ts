import { Sequelize } from "sequelize";
import mysql2 from 'mysql2';
import dotenv from "dotenv";
import path from "path";

// const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
// dotenv.config({ path: path.resolve(__dirname, `../../${envFile}`) });
// Determinar el archivo de entorno basado en NODE_ENV
const getEnvFile = () => {
  switch (process.env.NODE_ENV) {
    case 'production':
      return '.env.production';
    case 'qa':
      return '.env.qa';
    default:
      return '.env.development';
  }
};

const envFile = getEnvFile();
const envPath = path.resolve(__dirname, `../../${envFile}`);

// Cargar variables de entorno
dotenv.config({ path: envPath });

console.log(`AMBIENTE Y USUARIO: ${process.env.NODE_ENV} ,${process.env.DB_NAME}, ${process.env.DB_USER}` )

const db = new Sequelize(
  process.env.DB_NAME || "",
  process.env.DB_USER || "",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: "mysql",
    dialectModule: mysql2,
  }
);

export default db;