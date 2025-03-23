const fs = require("fs");
var Sniffr = require("sniffr").default;

const ANALYTICS_BASE_PATH = "./analytics/";
const USERS_PATH = ANALYTICS_BASE_PATH + "users.json";
var USERS = {};

const ACTION = {CHOOSE: 0, TRIP_INFO: 1, VEHICULE_INFO: 2};

async function analyse(req, action, data) {
    let uid = extractUID(req);
    if(uid == undefined) {
        return;
    }

    let time = new Date().getTime();
    switch(action) {
        case ACTION.CHOOSE:
            choose(req, uid, time, data);
            break;

        case ACTION.TRIP_INFO:
            tripInfo(req, uid, time, data);
            break;
        case ACTION.VEHICULE_INFO:
            vehiculeInfo(req, uid, time, data);
            break;
    }
}

function choose(req, uid, time, data) {
    let userObject = getUserObject(req, uid);
    userObject.directions.push({
        time: time,
        from: data[0],
        to: data[1],
        with: data[2]
    });    

    USERS[uid] = userObject;
    saveUsers();
}

function tripInfo(req, uid, time, data) {
    let userObject = getUserObject(req, uid);
    if(data.length == 0 || userObject.infos[data[0].trip_id] != undefined) {
        return;
    }

    let tripId = data[0].trip_id;
    userObject.infos[tripId] = {
        time: time,
        trip_id: tripId,
        from: data[0].station_name,
        to: data[data.length -1].station_name,
        direction: data[0].direction_id
    };    

    USERS[uid] = userObject;
    saveUsers();
}

function vehiculeInfo(req, uid, time, data) {
    let userObject = getUserObject(req, uid);
    if(data == null) {
        return;
    }

    userObject.vehicule.push({
        time: time,
        id: data["Numéro"]
    });

    USERS[uid] = userObject;
    saveUsers();
}

function extractUID(req) {
    return req.headers["x-application-uid"];
}

function getUserObject(req, uid) {
    let obj = USERS[uid];
    if(obj == undefined) {
        let clientData = new Sniffr().sniff(req.headers["user-agent"]);
        USERS[uid] = {
            uid: uid,
            os: clientData.os,
            device: clientData.device,
            browser: clientData.browser,
            directions: [],
            infos: {},
            vehicule: []
        };
        obj = USERS[uid];
    }
    return obj;
}

function saveUsers() {
    fs.writeFileSync(USERS_PATH, JSON.stringify(USERS));
}

if(!fs.existsSync(ANALYTICS_BASE_PATH)) {
    fs.mkdirSync(ANALYTICS_BASE_PATH);
}

if(fs.existsSync(USERS_PATH)) {
    USERS = JSON.parse(fs.readFileSync(USERS_PATH))
}


module.exports = {
    analyse,
    ACTION
}