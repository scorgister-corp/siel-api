const express = require('express');
const handler = require('./handler');
const analytics = require('./analytics');

const core = require('./core.js');

const VERSION = "1.3.0"


const app = express();
app.use(express.json());
app.use(express.urlencoded())
const handlers = handler(app, defaultMethodNotAllowedHandler);

app.options("*", (req, res) => {    
    send(res, {});
});

handlers.post("/info", (req, res) => {    
    if(req.body["vehicule_id"] == undefined) {
        send400(res);
        return;
    }

    let vehiculeId = req.body["vehicule_id"];

    core.getVehiculeInfo(vehiculeId).then(e => {
        analytics.analyse(req, analytics.ACTION.VEHICULE_INFO, e);
        
        send(res, e);
    });
});

handlers.get("/trip", (req, res) => {
    if(req.query["tripid"] == undefined) {
        send400(res);
        return;
    }

    core.getTripInfo(req.query["tripid"]).then(e => {
        analytics.analyse(req, analytics.ACTION.TRIP_INFO, e);
        send(res, e);
    });
});

handlers.get("/version", (req, res) => {
    send(res, {version: VERSION});
});

handlers.get("/clientinfos", (req, res) => {
    send(res, core.getClientInfos());
});

handlers.get("/stops", (req, res) => {
    send(res, core.getAllStops());
});

handlers.post("/choose", async (req, res) => {
    if(req.body["stop_name"] == undefined || req.body["directions"] == undefined) {
        send400(res);
        return;
    }

    analytics.analyse(req, analytics.ACTION.CHOOSE, [req.body["stop_name"], req.body["directions"]]);
    send(res, {}, 200);
});


handlers.post("/data", async (req, res) => {
    if(req.body["stop_name"] == undefined || req.body["directions"] == undefined) {
        send400(res);
        return;
    }
    
    core.getUpdate(req.body["stop_name"], req.body["directions"]).then(e => {
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

    let stopName = req.body["stop_name"];
    core.getDirectionsAndLines(stopName).then(e => {
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
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Application-UID");
    res.json(body);
}

module.exports.start = (port=8100) => {
    
    app.listen(port, () => {
        console.log("Server started at localhost:" + port);
    });
    return true;
};