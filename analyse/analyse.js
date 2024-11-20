const data = require('./datas.json');

const ARR = []
const DEP = []

data.forEach(elt => {
    if(elt.type == 0)
        ARR.push(elt);
    else
        DEP.push(elt);
});

function median(arr) {
    var m = 0
    arr.forEach(elt => {
        m += elt.arrival_delta;
    });
    return m / arr.length;
}

console.log(median(ARR));
console.log(median(DEP));
