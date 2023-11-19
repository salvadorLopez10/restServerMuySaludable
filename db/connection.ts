import { Sequelize } from "sequelize";

const db = new Sequelize(
  "muy_saludable_db",
  "root",
  "B34C4dFG6ahB64D5CA6bFbghH4bc2gfa",
  {
    //host: 'localhost',
    host: "monorail.proxy.rlwy.net",
    dialect: "mysql",
    //port: 8889
    port: 58219,
    //logging: false
  }
);

export default db;