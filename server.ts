import _http from "http";
import _url from "url";
import _fs from "fs";
import _express from "express";
import _dotenv from "dotenv";
import _cors from "cors";
import _fileUpload from "express-fileupload";
import _cloudinary from 'cloudinary';

// Lettura delle password e parametri fondamentali
_dotenv.config({ "path": ".env" });

// Configurazione Cloudinary
_cloudinary.v2.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key,
    api_secret: process.env.api_secret
});

// Variabili relative a MongoDB ed Express
import { MongoClient, ObjectId } from "mongodb";
const DBNAME = process.env.DBNAME;
const connectionString: string = process.env.connectionStringAtlas;
const app = _express();

// Creazione ed avvio del server
// app è il router di Express, si occupa di tutta la gestione delle richieste http
const PORT: number = parseInt(process.env.PORT);
let paginaErrore;
const server = _http.createServer(app);
// Il secondo parametro facoltativo ipAddress consente di mettere il server in ascolto su una delle interfacce della macchina, se non lo metto viene messo in ascolto su tutte le interfacce (3 --> loopback e 2 di rete)
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

//********************************************************************************************//
// Routes middleware
//********************************************************************************************//

// 1. Request log
app.use("/", (req: any, res: any, next: any) => {
    console.log(`-----> ${req.method}: ${req.originalUrl}`);
    next();
});

// 2. Gestione delle risorse statiche
// .static() è un metodo di express che ha già implementata la firma di sopra. Se trova il file fa la send() altrimenti fa la next()
app.use("/", _express.static("./static"));

// 3. Lettura dei parametri POST di req["body"] (bodyParser)
// .json() intercetta solo i parametri passati in json nel body della http request
app.use("/", _express.json({ "limit": "50mb" }));
// .urlencoded() intercetta solo i parametri passati in urlencoded nel body della http request
app.use("/", _express.urlencoded({ "limit": "50mb", "extended": true }));

// 4. Aggancio dei parametri del FormData e dei parametri scalari passati dentro il FormData
// Dimensione massima del file = 10 MB
app.use("/", _fileUpload({ "limits": { "fileSize": (10 * 1024 * 1024) } }));

// 5. Log dei parametri GET, POST, PUT, PATCH, DELETE
app.use("/", (req: any, res: any, next: any) => {
    if (Object.keys(req["query"]).length > 0) {
        console.log(`       ${JSON.stringify(req["query"])}`);
    }
    if (Object.keys(req["body"]).length > 0) {
        console.log(`       ${JSON.stringify(req["body"])}`);
    }
    next();
});

// 6. Controllo degli accessi tramite CORS
const corsOptions = {
    origin: function (origin, callback) {
        return callback(null, true);
    },
    credentials: true
};
app.use("/", _cors(corsOptions));

//********************************************************************************************//
// Routes finali di risposta al client
//********************************************************************************************//

app.get("/api/getImages", async (req, res, next) => {
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection("images");
    let rq = collection.find().toArray();
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.post("/api/addBinaryImage", (req, res, next) => {
    // 1 --> salvare su disco
    // 2 --> aggiungere un record nel database
    let username = req["body"].username;
    // img contiene due campi principali: 
    // img.name contiene il nome del file scelto dal client
    // img.data contiene il contenuto binario del file
    let img = req["files"].img;
    if (_fs.existsSync(`./static/img/${username}.jpg`)) {
        res.status(500).send("File già esistente");
    }
    else {
        _fs.writeFile(`./static/img/${username}.jpg`, img.data, async function (err) {
            if (err) {
                res.status(500).send(`Errore salvataggio file: ${err}`);
            }
            else {
                const client = new MongoClient(connectionString);
                await client.connect();
                let collection = client.db(DBNAME).collection("images");
                let rq = collection.insertOne({ username, "img": `${username}.jpg` });
                rq.then((data) => res.send(data));
                rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
                rq.finally(() => client.close());
            }
        });
    }
});

app.post("/api/addBase64Image", (req, res, next) => {
    let username = req["body"].username;
    let imgBase64 = req["body"].imgBase64;
    if (_fs.existsSync(`./static/img/${username}.jpg`)) {
        res.status(500).send("File già esistente");
    }
    else {
        imgBase64 = imgBase64.replace(/^data:image\/\w+;base64,/, "");
        let binaryImg = Buffer.from(imgBase64, "base64");
        _fs.writeFile(`./static/img/${username}.jpg`, binaryImg, async function (err) {
            if (err) {
                res.status(500).send(`Errore salvataggio file: ${err}`);
            }
            else {
                const client = new MongoClient(connectionString);
                await client.connect();
                let collection = client.db(DBNAME).collection("images");
                let rq = collection.insertOne({ username, "img": `${username}.jpg` });
                rq.then((data) => res.send(data));
                rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
                rq.finally(() => client.close());
            }
        });
    }
});

app.post("/api/addBase64CloudinaryImage", async (req, res, next) => {
    let username = req["body"].username;
    let imgBase64 = req["body"].imgBase64;
    _cloudinary.v2.uploader.upload(imgBase64, {"folder":"Es_03_Upload"})
    .catch((err)=>{
        res.status(500).send("Error uploading file on Cloudinary: " + err)
    })
    .then(async(cloudinaryUrl)=>{
        const client = new MongoClient(connectionString);
        await client.connect();
        let collection = client.db(DBNAME).collection("images");
        let rq = collection.insertOne({ username, "img": cloudinaryUrl });
        rq.then((data) => res.send(data));
        rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
        rq.finally(() => client.close());
    })
    
});

//********************************************************************************************//
// Default route e gestione degli errori
//********************************************************************************************//

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