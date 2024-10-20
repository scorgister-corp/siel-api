const express = require('express');
const handler = require('./handler')
const utils = require('./utils.js');

const VERSION = "1.0.0"


const app = express();
app.use(express.json());
const handlers = handler(app, defaultMethodNotAllowedHandler);

app.options("*", (req, res) => {
    send(res, {});
});


handlers.get("/version", (req, res) => {
    send(res, {version: VERSION});
});

handlers.get("/stops", (req, res) => {
    send(res, utils.getAllStops());
});


handlers.post("/data", async (req, res) => {
    if(req.body["stop_name"] == undefined || req.body["direction"] == undefined || req.body["line"] == undefined) {
        send400(res);
        return;
    }

    var data = await  utils.getData(req.body["stop_name"], req.body["direction"], req.body["line"]);
    send(res, data);
});

handlers.post("/alert", async (req, res) => {
    if(req.body["line"] == undefined) {
        send400(res);
        return;
    }

    var data = await utils.getAlert(req.body["line"]);
        
    send(res, data);
});

handlers.post("/directions", async (req, res) => {
    if(req.body["stop_name"] == undefined) {
        send400(res);
        return;
    }

    send(res, utils.getDirections(req.body["stop_name"]));
});

handlers.post("/lines", async (req, res) => {
    if(req.body["stop_name"] == undefined) {
        send400(res);
        return;
    }

    send(res, utils.getLines(req.body["stop_name"]));
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
    res.set("Access-Control-Allow-Headers", "*");
    res.json(body);
}

module.exports.start = (port=8100) => {
    
    app.listen(port, () => {
        console.log("Server started at localhost:" + port);
    });
    return true;
};