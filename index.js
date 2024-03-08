const express = require ("express")
const bodyParser = require("body-parser")
const cors = require("cors")
const axios =require ("axios")
const sha256 =require ("sha256")
const uniqid= require ("uniqid")
const  { con }=require ('./db/db.js')
require("dotenv").config();

const {makeDb} = require ('./db/db.js')
const db = makeDb();
const app = express();

const PHONE_PE_HOST_URL = process.env.PHONE_PE_HOST_URL
const MERCHANT_ID = process.env.MERCHANT_ID
const SALT_INDEX = process.env.SALT_INDEX
const SALT_KEY = process.env.SALT_KEY
const  APP_BE_URL = process.env.BASE_URL
const PAYMENT_STATUS_URL = process.env.PAYMENT_STATUS_URL
// setting up middleware
con.connect(function (err) {
	if (err) throw err;
	console.log("Connected!");
});
app.use(cors());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);

// Defining a test route
app.get("/", (req, res) => {
  res.send("PhonePe Integration APIs!");
});

// endpoint to initiate a payment
app.get("/pay", async function (req, res, next) {
  // Initiate a payment
  // Transaction amount
  const amount = 100;

  // User ID is the ID of the user present in our application DB
  let userId = "MUID123";

  // Generate a unique merchant transaction ID for each transaction
  let merchantTransactionId = uniqid();
  // or
  // const merchantTransactionId = 'M' + Date.now();

  // redirect url => phonePe will redirect the user to this url once payment is completed. It will be a GET request, since redirectMode is "REDIRECT"
  let normalPayLoad = {
    merchantId: MERCHANT_ID, //* PHONEPE_MERCHANT_ID . Unique for each account (private)
    merchantTransactionId: merchantTransactionId,
    merchantUserId: userId,
    amount: amount * 1, // converting to paise
    redirectUrl: `${APP_BE_URL}/payment/validate/${merchantTransactionId}`,
    redirectMode: "REDIRECT",
    mobileNumber: "9999999999",
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  // make base64 encoded payload
  let bufferObj = Buffer.from(JSON.stringify(normalPayLoad), "utf8");
  let base64EncodedPayload = bufferObj.toString("base64");

  // X-VERIFY => SHA256(base64EncodedPayload + "/pg/v1/pay" + SALT_KEY) + ### + SALT_INDEX
  let string = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
  let sha256_val = sha256(string);
  let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

  axios.post(
    `${PHONE_PE_HOST_URL}/pg/v1/pay`,
    {
      request: base64EncodedPayload,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerifyChecksum,
        accept: "application/json",
      },
    }
  )
    .then(function (response) {
      console.log(response.data)
      res.redirect(response.data.data.instrumentResponse.redirectInfo.url);
    })
    .catch(function (error) {
        console.log("error->", error);
      res.send(error);
    });
});

// endpoint to check the status of payment
app.get("/payment/validate/:merchantTransactionId", async function (req, res) {
  try {
    const { merchantTransactionId } = req.params;
    // check the status of the payment using merchantTransactionId
    if (merchantTransactionId) {

    let checkTransaction = `select merchantTransactionId from payments where merchantTransactionId = '${merchantTransactionId}'`;
    let result1 = await db.query(checkTransaction)
    if(result1.length){  return res.status(200).json({ status: true, message: "merchantTransactionId already exist" }) }
    
     let statusUrl =
        `${PHONE_PE_HOST_URL}/pg/v1/status/${MERCHANT_ID}/` +
        merchantTransactionId;
  
      // generate X-VERIFY
      let string =
        `/pg/v1/status/${MERCHANT_ID}/` + merchantTransactionId + SALT_KEY;
      let sha256_val = sha256(string);
      let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;
  
      let result = await  axios
        .get(statusUrl, {
          headers: {
            "Content-Type": "application/json",
            "X-VERIFY": xVerifyChecksum,
            "X-MERCHANT-ID": merchantTransactionId,
            accept: "application/json",
          },
        })
        // if (response.data && response.data.code === "PAYMENT_SUCCESS")
        console.log(result,"0-9-9-90-90")
       if(result.data){
        let Query = `insert into payments (merchantTransactionId,success,data,amount) values 
             ('${result.data.data.merchantTransactionId}','${result.data.success}','${JSON.stringify(result.data.data)}','${result.data.data.amount}')`
       let data= await db.query(Query)
         if(data.affectedRows>0){
         return res.status(200).json({ status: true, message: "payment success" });
         }
       }
    } else {
      return res.status(400).json({ status: false, message: "No merchantTransactionId" });
    }
  } catch (error) {
    console.log(error)
    return res.status(500).json({ status: 500, message: error.message });
    
  }
});

app.get("/paymentReal/validate/:merchantTransactionId", async function (req, res) {
  try {
    const { merchantTransactionId } = req.params;
    // check the status of the payment using merchantTransactionId
    if (merchantTransactionId) {

    let checkTransaction = `select merchantTransactionId from payments where merchantTransactionId = '${merchantTransactionId}'`;
    let result1 = await db.query(checkTransaction)
    if(result1.length){  return res.status(200).json({ status: true, message: "merchantTransactionId already exist" }) }
    
     let statusUrl =
        `${PAYMENT_STATUS_URL}/v3/transaction/${MERCHANT_ID}/${merchantTransactionId}/status` 

      let string =
        `/v3/transaction/${MERCHANT_ID}/${merchantTransactionId}/status`+ SALT_KEY;
      let sha256_val = sha256(string);
      let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;
  
      let result = await  axios
        .get(statusUrl, {
          headers: {
            "Content-Type": "application/json",
            "X-VERIFY": xVerifyChecksum,
            "X-MERCHANT-ID": merchantTransactionId,
            accept: "application/json",
          },
        })
        // if (response.data && response.data.code === "PAYMENT_SUCCESS")
        console.log(result,"0-9-9-90-90")
       if(result.data){
        let Query = `insert into payments (merchantTransactionId,success,data,amount) values 
             ('${result.data.data.transactionId}','${result.data.success}','${JSON.stringify(result.data.data)}','${result.data.data.amount/100}')`
       let data= await db.query(Query)
         if(data.affectedRows>0){
         return res.status(200).json({ status: true, message: "payment success" });
         }
       }
    } else {
      return res.status(400).json({ status: false, message: "No merchantTransactionId" });
    }
  } catch (error) {
    console.log(error)
    return res.status(500).json({ status: 500, message: error.message });
    
  }
});

// Starting the server
const port = 3000;
app.listen(port, () => {
  console.log(`PhonePe application listening on port ${port}`);
});