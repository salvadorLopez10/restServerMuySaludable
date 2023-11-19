import express, { Application } from 'express';
import userRoutes from "../routes/usuario";
import alimentoRoutes from "../routes/alimento";
import catalogoPorcionTiposRoutes from "../routes/catalogo_porcion_tipo";
import comidasRoutes from "../routes/comida";
import alimentosComidasRoutes from "../routes/alimentos_comida";
import cors from "cors";
import db from '../db/connection';

class Server {
  private app: Application;
  private port: string;
  private apiPaths = {
    usuarios: "/api/usuarios",
    alimentos: "/api/alimentos",
    catalogoPorcionTipos: "/api/catalogoPorcionTipos",
    comidas: "/api/comidas",
    alimentosComida: "/api/alimentosComida",
  };

  constructor() {
    this.app = express();
    this.port = process.env.PORT || "8000";

    this.dbConnection();
    this.middlewares();
    this.routes();
  }

  async dbConnection() {
    try {
      await db.authenticate();
      console.log("DATABASE CONNECTED");
    } catch (error) {
      console.log("ERROR " + error);
    }
  }

  middlewares() {
    //CORS
    this.app.use(cors());
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', '*');
      res.header('Access-Control-Allow-Methods', '*');
      next();
    });

    //Lectura del body
    this.app.use(express.json());

    //Carpeta públia
    this.app.use(express.static("public"));
  }

  routes() {
    this.app.use(this.apiPaths.usuarios, userRoutes);
    this.app.use(this.apiPaths.alimentos, alimentoRoutes);
    this.app.use(this.apiPaths.catalogoPorcionTipos,catalogoPorcionTiposRoutes);
    this.app.use(this.apiPaths.comidas, comidasRoutes);
    this.app.use(this.apiPaths.alimentosComida, alimentosComidasRoutes);

  }

  listen() {
    this.app.listen(this.port, () => {
      console.log("Servidor corriendo en el puerto: " + this.port);
    });
  }
}

export default Server;
