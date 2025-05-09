import express, { Application } from 'express';
import userRoutes from "../routes/usuario";
import alimentoRoutes from "../routes/alimento";
import nuevosAlimentoRoutes from "../routes/nuevos_alimentos";
import catalogoPorcionTiposRoutes from "../routes/catalogo_porcion_tipo";
import comidasRoutes from "../routes/comida";
import alimentosComidasRoutes from "../routes/alimentos_comida";
import planesRoutes from "../routes/planes_alimenticio";
import suscripcionesRoutes from "../routes/suscripcion";
import stripeRoutes from "../routes/stripe";
import codigosRoutes from "../routes/codigos_descuento";
import configsRoutes from "../routes/config";
import saludRoutes from "../routes/salud_financiera_mental";
import planNutricionalRoutes from "../routes/plan_nutricional";
import mailServiceRoutes from "../routes/mailService";
import carouselRoutes from "../routes/carousel_images";
import rutinasRoutes from "../routes/info_rutinas";
import recomendacionesRoutes from "../routes/recomendaciones_planes";
import cors from "cors";
import db from '../db/connection';

class Server {
  public app: Application;
  private port: string;
  private apiPaths = {
    usuarios: "/api/usuarios",
    alimentos: "/api/alimentos",
    nuevosAlimentos: "/api/nuevosAlimentos",
    catalogoPorcionTipos: "/api/catalogoPorcionTipos",
    comidas: "/api/comidas",
    alimentosComida: "/api/alimentosComida",
    planesAlimenticios: "/api/planesAlimenticios",
    suscripciones: "/api/suscripciones",
    stripe: "/api/stripe/create",
    codigosDescuento: "/api/codigosDescuento",
    config: "/api/config",
    salud: "/api/salud",
    planNutricional: "/api/planNutricional",
    sendEmail: "/api/sendEmail",
    carousel: "/api/carousel",
    rutinas: "/api/rutinas",
    recomendaciones: "/api/recomendaciones",
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
    this.app.use((req, res, next) => {
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
    this.app.use(this.apiPaths.nuevosAlimentos, nuevosAlimentoRoutes);
    this.app.use(this.apiPaths.catalogoPorcionTipos,catalogoPorcionTiposRoutes);
    this.app.use(this.apiPaths.comidas, comidasRoutes);
    this.app.use(this.apiPaths.alimentosComida, alimentosComidasRoutes);
    this.app.use(this.apiPaths.planesAlimenticios, planesRoutes);
    this.app.use(this.apiPaths.suscripciones, suscripcionesRoutes);
    this.app.use(this.apiPaths.stripe, stripeRoutes);
    this.app.use(this.apiPaths.codigosDescuento, codigosRoutes);
    this.app.use(this.apiPaths.config, configsRoutes);
    this.app.use(this.apiPaths.salud, saludRoutes);
    this.app.use(this.apiPaths.planNutricional, planNutricionalRoutes);
    this.app.use(this.apiPaths.sendEmail, mailServiceRoutes);
    this.app.use(this.apiPaths.carousel, carouselRoutes);
    this.app.use(this.apiPaths.rutinas, rutinasRoutes);
    this.app.use(this.apiPaths.recomendaciones, recomendacionesRoutes);
  }

  listen() {
    this.app.listen(this.port, () => {
      console.log("Servidor corriendo en el puerto: " + this.port);
    });
  }
}

export default Server;
