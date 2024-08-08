import { Sequelize } from "sequelize";

const db = new Sequelize(
  "muy_saludable_db",
  //"root",
  "master",
  //"B34C4dFG6ahB64D5CA6bFbghH4bc2gfa",
  //"root",
  "]NmGhf)vwZJ8",
  {
    //host: 'localhost',
    host: "107.180.114.45",
    dialect: "mysql",
    //port: 8889
    port: 3306,
    //logging: false
  }
);

export default db;