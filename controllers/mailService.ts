import { Request, Response } from "express";
import Planes_Alimenticios from "../models/planes_alimenticio";
import nodemailer from 'nodemailer';

export const sendEmail = async (req: Request, res: Response) => {
    const { body } = req;

    const email = body.email;
    const planElegido = body.plan;

    //  Obtenemos detalle del plan elegido
    const plan = await Planes_Alimenticios.findByPk(planElegido);

    var nombrePlan = undefined;
    var caracteristicas = undefined;
    var precioRegular = undefined;
    var precioReal = undefined;
    if (plan) {
       console.log(plan);
       nombrePlan = plan.get('nombre');
       caracteristicas = plan.get('descripcion_detallada');
       precioRegular = plan.get('precio_regular');
       precioReal = plan.get('precio');
       const transporter = nodemailer.createTransport({
           host: 'smtpout.secureserver.net',
           port: 465,
           secure: true, // true para usar SSL
           auth: {
               user: 'daniel@muysaludable.com.mx',
               pass: 'Felixelgato1234$',
           },
       });

       var stringCaracteristicas = "";
       var arrCaracteristicas = typeof caracteristicas === 'string' ? caracteristicas.split('\n') : [];

       for (let index = 0; index < arrCaracteristicas.length; index++) {
        const element = arrCaracteristicas[index];
        stringCaracteristicas += `<li>${element}</li>`;
       }
       
   
       // Cuerpo del mensaje
       const mailOptions = {
           from: '"Muy Saludable" <no-reply@muysaludable.com.mx>',
           to: email, // Dirección del destinatario
           subject: `Resumen de tu plan alimenticio: El plan elegido ${planElegido}`,
           html: `
           <!DOCTYPE html>
           <html lang="es">
           <head>
               <meta charset="UTF-8">
               <meta name="viewport" content="width=device-width, initial-scale=1.0">
               <title>Email Template</title>
               <style>
                   body {
                       background-color: #f0f0f0; /* Fondo gris tenue */
                       margin: 0;
                       padding: 0;
                       font-family: Arial, sans-serif;
                   }
                   .container {
                       max-width: 90%;
                       background-color: #ffffff; /* Contenedor blanco */
                       margin: 50px auto; /* Centrado horizontal */
                       padding: 20px;
                       box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                       border-radius: 10px;
                       text-align: center; /* Centrar el contenido */
                   }
                   .container img {
                       max-width: 100px;
                   }
                   .container h1 {
                       font-size: 20px;
                       font-weight: bold;
                       margin-top: 20px;
                       margin-bottom: 30px;
                   }
                   .container h3 {
                       font-size: 18px;
                       font-weight: bold;
                       margin-top: 20px;
                       margin-bottom: 30px;
                   }
                   .container h2 {
                       font-size: 16px;
                       font-weight: bold;
                       margin-top: 20px;
                       margin-bottom: 30px;
                   }
                   .container ul {
                        list-style-type: disc; /* Viñetas */
                        list-style-position: inside; /* Alineación correcta de viñetas */
                        text-align: left; /* Alineación del texto de la lista a la izquierda */
                        padding-left: 0; /* Sin margen adicional en la izquierda */
                        font-size: 16px;
                        color: #000000; /* Texto negro */
                        margin-left: 20%; /* Margen izquierdo para alinear bien con el centro */
                        margin-right: 20%; /* Margen derecho */
                    }
                    .container ul li {
                        margin-bottom: 10px;
                    }
           
                   .container .price {
                       font-size: 16px;
                       color: #326807;
                       margin-top: 20px;
                   }
                   .container .price .original-price {
                       text-decoration: line-through;
                       margin-right: 5px;
                   }
                   .container a {
                       display: inline-block;
                       margin-top: 30px;
                       padding: 10px 20px;
                       background-color: #F9A02A;
                       color: #ffffff;
                       text-decoration: none;
                       border-radius: 5px;
                       font-size: 16px;
                   }
                   .divider {
                       border-top: 1px solid #cccccc;
                       margin: 40px 0;
                   }
                   .footer-text {
                       font-size: 12px;
                       color: #999999;
                   }
               </style>
           </head>
           <body>
               <div class="container">
                   <!-- Imagen centrada -->
                   <img src="https://muysaludable.com.mx/wp-content/uploads/2020/08/cropped-Logo-Muy-Saludable-2-99x103.png" alt="Logo Muy Saludable">
   
                   <!-- Texto principal -->
                   <h1>Hemos recibido tu solicitud para generar tu registro</h1>
                   <h2>A continuación verás el resumen del plan elegido</h2>
   
                   <!-- Características del plan -->
                   <h2>${nombrePlan}</h2>
                   <ul>
                      ${stringCaracteristicas}
                   </ul>
                   
                   <p class="price">
                       Te ofrecemos el precio preferencial de 
                       <span class="original-price">$ ${precioRegular}</span> a $ ${precioReal}
                   </p>
           
   
                   <!-- Link para continuar registro -->
                   <a href="https://muysaludable.com.mx/" target="_blank">Completar registro</a>
   
                   <!-- Línea divisoria -->
                   <div class="divider"></div>
   
                   <!-- Texto de pie -->
                   <p class="footer-text">
                       Muy Saludable te envió este mensaje a ${email} porque creaste una cuenta.
                   </p>
               </div>
           </body>
           </html>
           `,
       };
   
       try {
   
           const info = await transporter.sendMail(mailOptions);
           console.log("EL CORREO SE HA ENVIADO A: " + email);
   
           console.log(JSON.stringify( info,null,3 ));
   
           res.status(200).json({
               status: `Ok`,
               msg: "El correo se ha enviado correctamente",
               data: "Correo enviado"
           });
       } catch (error) {
           console.log(error);
           res.status(500).json({
               status: "Error",
               msg: "Error: Contacte al administrador",
               data: error
           });
       }
    }else{
        res.status(404).json({
            status: "Error",
            msg: `Error: No existe información para el plan con el id ${planElegido}`,
            data: ""
        });
    }


   

};


