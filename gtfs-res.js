const CALENDAR_DATES = require("./gtfs/calendar_dates.json");
const ROUTES = require("./gtfs/routes.json");
const STOP_TIMES = require("./gtfs/stop_times.json");
const STOPS = require("./gtfs/stops.json");
const TRIPS = require("./gtfs/trips.json");

function getTodayServices() {
    let date = getTodayDate();
    const data = [];

    for(let d of CALENDAR_DATES) {
        if(d.date == date) {
            data.push(d);
        }
    }    
    return data
}

function getTodayTrips() {
    let services = getTodayServices();

    const data = [];
    for(let trip of TRIPS) {
        if(services.some((e) => {return e.service_id == trip.service_id;})) {
            data.push(trip)
        }
    }

    return data;
}

function getTripStopTimes(tripId) {
    const data = [];
    for(let st of Object.keys(STOP_TIMES[tripId])) {
        data.push({
            stop_id: st,
            time: STOP_TIMES[tripId][st]
        })        
    }

    return data;
}

function getTripStopTime(tripId, stopId) {
    return STOP_TIMES[tripId][stopId];
}

function getTodayDate() {
    let date = new Date();
    let m = (date.getMonth() + 1).toString();
    if(m.length == 1)
        m = "0" + m;

    let d = date.getDate().toString();
    if(d.length == 1)
        d = "0" + d;

    return date.getFullYear() + m + d;
}

function getRoute(routeId) {
    return ROUTES[routeId];
}

function getStopIds(stopName) {
    const data = [];
    for(let s of Object.values(STOPS)) {
        if(s.stop_name.toUpperCase() == stopName.toUpperCase())
            data.push(s.stop_id);
    }

    return data;
}

function getStopName(stopId) {
    return STOPS[stopId].stop_name;
}

function getOtherTripIds(exculdeIds, deepSec, stopIds) {
    let todayTrip = getTodayTrips();
    console.log(stopIds);
    
    const datas = [];

    let n = new Date();
	if(n.getTimezoneOffset() != 0)
	    n.setMinutes(-n.getTimezoneOffset());
    console.log(n);
    
    for(let tt of todayTrip) {
        for(let sti of Object.keys(stopIds)) {
            if(STOP_TIMES[tt.trip_id][sti]) {
                let h = STOP_TIMES[tt.trip_id][sti].split(":")[0], m = STOP_TIMES[tt.trip_id][sti].split(":")[1], s = STOP_TIMES[tt.trip_id][sti].split(":")[2];
                let c = createDate(h, m, s);
                
                if(c.getTime() >= n.getTime() && c.getTime() - n.getTime() <= 3600000) {
                    //console.log(c);
                    datas.push(tt.trip_id);
                }
            }
        }
    }
    console.log(datas);
    return datas;
}

function createDate(h, m, s) {
	var time = new Date(0);
	time.setHours(h);
	time.setMinutes(m);
	time.setSeconds(s);

	var now = new Date();
	if(now.getTimezoneOffset() != 0)
		now.setMinutes(-now.getTimezoneOffset());
	if(time.getHours() == now.getHours()) {
		if(time.getMinutes() < now.getMinutes()) {
			return new Date();
		}
		now.setMinutes(time.getMinutes());
		now.setSeconds(time.getSeconds());
	}else if(time.getHours() < now.getHours()) {
		now.setDate(now.getDate() + 1);
		now.setHours(time.getHours());
		now.setMinutes(time.getMinutes());
		now.setSeconds(time.getSeconds());
	}else {
		now.setHours(time.getHours());
		now.setMinutes(time.getMinutes());
		now.setSeconds(time.getSeconds());
	}

	return now;
}

module.exports = {
    getTodayServices,
    getTodayTrips,
    getTripStopTimes,
    getTripStopTime,
    getTodayDate,
    getRoute,
    getStopIds,
    getStopName,
    getOtherTripIds
};