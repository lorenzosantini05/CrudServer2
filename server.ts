import _http from "http";
import _url from "url";
import _fs from "fs";
import _express from "express";
import _cors from "cors";
import _dotenv from "dotenv";
_dotenv.config({ path: ".env" });


// Variabili relative a MongoDB ed Express
import { MongoClient, ObjectId } from "mongodb";
const connectionString:string = process.env.connectionStringAtlas;
const DBNAME = process.env.DBNAME
const app = _express();


// Creazione e avvio del server
const PORT:number = parseInt(process.env.PORT)
let paginaErrore;
const server = _http.createServer(app);
server.listen(PORT, () => {
    init();
    console.log(`Il Server è in ascolto sulla porta ${PORT}`);
});

function init() {
    _fs.readFile("./static/error.html", function (err, data) {
        if (err) {
            paginaErrore = `<h1>Risorsa non trovata</h1>`;
        }
        else {
            paginaErrore = data.toString();
        }
    });
}


//****************************************************************************//
// Routes middleware
//****************************************************************************//

// 1. Request log
app.use("/", (req: any, res: any, next: any) => {
    console.log(`-----> ${req.method}: ${req.originalUrl}`);
    next();
});


// 2. Gestione delle risorse statiche
app.use("/", _express.static("./static"));


// 3. Lettura dei parametri POST 
// .json() intercetta i parametri json nel body della http request
app.use("/", _express.json({ "limit": "50mb" }));
// .urlencoded() intercetta i parametri urlencoded nel body della http request
app.use("/", _express.urlencoded({ "limit": "50mb", "extended": true }));


// 4. Log dei parametri 
app.use("/", (req: any, res: any, next: any) => {
    if (Object.keys(req["query"]).length > 0) {
        console.log(`       ${JSON.stringify(req["query"])}`);
    }
    if (Object.keys(req["body"]).length > 0) {
        console.log(`       ${JSON.stringify(req["body"])}`);
    }
    next();
});


// 5 - CORS Policy
const corsOptions = {
    origin: function(origin, callback) {
          return callback(null, true);
    },
    credentials: true
};
app.use("/", _cors(corsOptions));


//****************************************************************************//
// Routes finali di risposta al client
//****************************************************************************//

/* ************************************************************************** */
// Servizi Specifici
// Devono essere messi all'inizio perchè altrimenti risponderebbero 
// le routes parametriche già scritte
app.get("/api/getBrands", async (req, res, next) => {
    let selectedCollection = "models";
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.distinct("marca");
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.get("/api/getCities", async (req, res, next) => {
    let selectedCollection = "concerti";
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.distinct("sede.citta");
    rq.then((data) =>  res.send(data) );
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});
app.get("/api/getGenders", async (req, res, next) => {
    let selectedCollection = "concerti";
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.distinct("genere");
    rq.then((data) =>  res.send(data) );
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});


/* ************************************************************************** */


app.get("/api/getCollections", async (req, res, next) => {
    const client = new MongoClient(connectionString);
    await client.connect();
    let db = client.db(DBNAME);
    let rq = db.listCollections().toArray();
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore lettura collezioni: ${err}`))
    rq.finally(() => client.close());
});

app.get("/api/:collection", async (req, res, next) => {
    let filters = req["query"];
    let selectedCollection = req["params"].collection;
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.find(filters).toArray();
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.get("/api/:collection/:id", async (req, res, next) => {
    let selectedCollection = req["params"].collection;
	let id = req["params"].id
    let objId;
	if(ObjectId.isValid(id)) 
		objId = new ObjectId(id)
	else
		objId = id as unknown as ObjectId;	    
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.findOne({ "_id":objId });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.post("/api/:collection", async (req, res, next) => {
    let newRecord = req["body"];
    let selectedCollection = req["params"].collection;
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.insertOne(newRecord);
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.delete("/api/:collection/:id", async (req, res, next) => {
	let id = req["params"].id
    let objId;
	if(ObjectId.isValid(id)) 
		objId = new ObjectId(id)
	else
		objId = id as unknown as ObjectId;	    
	let selectedCollection = req["params"].collection;
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.deleteOne({"_id" : objId});
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.delete("/api/:collection/", async (req, res, next) => {
    let selectedCollection = req["params"].collection;
	let filter = req["body"]
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.deleteMany(filter);
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

/**
   * Chiama il metodo PATCH con l'obbligo di specificare nel body la ACTION da eseguire.
   *
   * @remarks
   * Utilizzando questo metodo la PATCH risulta più flessibile.
   *
   * @param id - id del record
   * @body i nuovi valori da aggiornare, ad esempio: {"$inc":{"qta":1}}
   * @returns Un JSON di conferma dell'aggiornamento
   */
app.patch("/api/:collection/:id", async (req, res, next) => {
	let selectedCollection = req["params"].collection;
	let id = req["params"].id
    let objId;
	if(ObjectId.isValid(id))  
		objId = new ObjectId(id)
	else
		objId = id as unknown as ObjectId;	  
	let action = req["body"];
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.updateOne({"_id" : objId}, action);
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.patch("/api/:collection", async (req, res, next) => {
    let selectedCollection = req["params"].collection;
	let filter=req["body"].filter;
	let action = req["body"].action;
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.updateMany(filter, action);
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

/**
   * Chiama il metodo PUT aggiornando il record invece che sostituirlo.
   *
   * @remarks
   * Utilizzando questo metodo la PUT esegue direttamente il SET del valore ricevuto.
   *
   * @param id - id del record
   * @body i nuovi valori da aggiornare
   * @returns Un JSON di conferma dell'aggiornamento
   */
app.put("/api/:collection/:id", async (req, res, next) => {
	let id = req["params"].id
    let objId;
	if(ObjectId.isValid(id)) 
		objId = new ObjectId(id)
	else
		objId = id as unknown as ObjectId;	    
    let selectedCollection = req["params"].collection;
	let newValues = req["body"]; 
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection(selectedCollection);
    let rq = collection.updateOne({"_id":objId}, {"$set":newValues});
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});



//****************************************************************************//
//  Default route e gestione degli errori
//****************************************************************************//

app.use("/", (req, res, next) => {
    res.status(404);
    if (req.originalUrl.startsWith("/api/")) {
        res.send(`Api non disponibile`);
    }
    else {
        res.send(paginaErrore);
    }
});

app.use("/", (err, req, res, next) => {
    console.log("************* SERVER ERROR ***************\n", err.stack);
    res.status(500).send(err.message);
});