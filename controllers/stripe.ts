import { Request, Response } from "express";
const Stripe = require('stripe');
const stripe = new Stripe("sk_test_51Oq6azDzbFBwqYhAO01PwHyNpNDXHQqa5Jt5u8ZZyFPd2FP0FvbMwO4PQ6VFs4UmeD1K70dkiKZvipkJ2NhmSmcY00ecKMOkH8");

export const createPayment = async (req: Request, res: Response) => {
  const data = req.body;
  console.log("Petición pago");
  console.log(JSON.stringify(data,null,2));

  try {
    const infoPaymentCreate = {
      // amount: data.amount,
      amount: data.amount,
      currency: 'MXN',
      description: 'Paquete adquirido: ' + data.plan,
      source : data.id, //Token obtenido desde la app
      //confirm: true

    }
     console.log(JSON.stringify(infoPaymentCreate,null,2));
    //const payment = await stripe.paymentIntents.create(infoPaymentCreate);
    const payment = await stripe.charges.create(infoPaymentCreate);

    console.log("PAYMENT RESPONSE: "+ JSON.stringify(payment,null,3));

    res.status(200).json({
      success: true,
      message: "Transaccion exitosa"
    });
    
  } catch (error) {
    console.log("ERROR PAGO STRIPE: "+ error)
    res.status(501).json({
      success: false,
      message: "Error en la transaccion:" + error,
      error: error
    })
    
  }
};