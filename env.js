const fs = require('fs');

function loadFile(fileName="./.env") {
    var f = fs.readFileSync(fileName).toString();
    var lines = "";
    
    if(f.includes("\r"))
        lines = f.split("\r\n");
    else
        lines = f.split("\n");

    var res = {};

    for(var i = 0; i < lines.length; i++) {
        var l = lines[i];
        if(l == '')
            continue;
        
        var key = l.slice(0, l.indexOf("="));
        var val = l.slice(l.indexOf("=") + 1);

        res[key] = val;
    }

    return res;
}

function saveFile(res, fileName="./.env") {
    var f = fs.readFileSync(fileName).toString();
    var lines = "";

    for(var key in res) {
        lines += key + "=" + res[key] + "\n";
    }

    fs.writeFileSync(fileName, lines);
}

module.exports.loadFile = loadFile;
module.exports.saveFile = saveFile;
