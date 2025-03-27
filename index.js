const server = require('./server.js');
const env = require("./env.js");

const ENV = env.loadFile("./.env");
if(ENV["SERVER_PORT"] == undefined) {
    console.error("SERVER_PORT introuvable dans le fichier .env (exit)");
    return;
}

server.start(ENV["SERVER_PORT"]);
