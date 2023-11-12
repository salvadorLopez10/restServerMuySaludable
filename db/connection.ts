import { Sequelize } from "sequelize";

const db = new Sequelize( 'muy_saludable_db', 'root', 'root', {
    host: 'localhost',
    dialect: 'mysql',
    port: 8889
    //logging: false
});

export default db;