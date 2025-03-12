const express = require('express');
const handler = require('./handler')
//const utils = require('./utils.js');
const core = require('./core.js');
const fs = require('fs');

const VERSION = "1.2.0"


const app = express();
app.use(express.json());
app.use(express.urlencoded())
const handlers = handler(app, defaultMethodNotAllowedHandler);

app.options("*", (req, res) => {
    send(res, {});
});

/*
handlers.post("/analyse", (req, res) => {   
    var currentData = []; 
    if(fs.existsSync("./datas.json")) {
        currentData = JSON.parse(fs.readFileSync("./datas.json"));
    }

    for(var i = 0; i < req.body.length; i++)
        currentData.push(req.body[i]);
    
    fs.writeFileSync("./datas.json", JSON.stringify(currentData));
    

    send(res, {});
});
*/

handlers.post("/info", (req, res) => {    
    if(req.body["vehicule_id"] == undefined) {
        send400(res);
        return;
    }

    core.getVehiculeInfo(req.body["vehicule_id"]).then(e => {
        send(res, e);
    });
});

handlers.get("/trip", (req, res) => {    
    core.getTripInfo(req.query["tripid"]).then(e => {
        send(res, e);
    });
});

handlers.get("/version", (req, res) => {
    send(res, {version: VERSION});
});

handlers.get("/stops", (req, res) => {
    send(res, core.getAllStops());
});


handlers.post("/data", async (req, res) => {
    if(req.body["stop_name"] == undefined || req.body["direction"] == undefined || req.body["line"] == undefined) {
        send400(res);
        return;
    }
    
    core.getUpdate(req.body["stop_name"], req.body["direction"], req.body["line"]).then(e => {
        send(res, e);
    });
});

handlers.post("/alert", async (req, res) => {
    if(req.body["line"] == undefined) {
        send400(res);
        return;
    }

    core.getAlerts(req.body["line"]).then(e => {
        send(res, e);
    });
});


handlers.post("/stopdata", async (req, res) => {
    if(req.body["stop_name"] == undefined) {
        send400(res);
        return;
    }
    core.getDirectionsAndLines(req.body["stop_name"]).then(e => {
        send(res, e);
    });
});

// send 404
handlers.all("*", (req, res) => {
    send404(res);
})

function send400(res) {
    sendError(res, "Bad Request", 400);
}

function send401(res) {
    sendError(res, "Unauthorized", 401);
}

function send404(res) {
    sendError(res, "Not Found", 404);
}

function send405(res) {
    sendError(res, "Method Not Allowed", 405);
}

function sendError(res, msg, code) {
    send(res, {error: code, message: msg}, code);
}


function defaultMethodNotAllowedHandler(req, res) {
    send405(res);
}

/**
 * 
 * @param {express.Response} res 
 * @param {JSON} body 
 * @param {int} code 
 */
function send(res, body, code=200) {
    res.status(code);
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.json(body);
}

module.exports.start = (port=8100) => {
    
    app.listen(port, () => {
        console.log("Server started at localhost:" + port);
    });
    return true;
};