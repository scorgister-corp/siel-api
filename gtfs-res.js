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
    return data;
}

function getTodayTrips() {
    let services = getTodayServices();

    const data = [];
    for(let trip of Object.values(TRIPS)) {
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
    if(date.getHours() < 3) {
        date.setHours(-24);
    }
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
    if(STOPS[stopId] == undefined)
        return undefined;
    
    return STOPS[stopId].stop_name;
}

function getStaticDepartureDestinationName(tripId) {
    if(!STOP_TIMES[tripId])
        return undefined;
    
    let times = Object.values(STOP_TIMES[tripId]);
    let departureName = undefined;
    let destinationName = undefined;
    times.sort((a, b) => a.localeCompare(b));
    for(let st of Object.keys(STOP_TIMES[tripId])) {
        if(STOP_TIMES[tripId][st] == times[0]) {
            departureName = getStopName(st);
        }

        if(STOP_TIMES[tripId][st] == times[times.length-1]) {
            destinationName = getStopName(st);
        }

        if(departureName && destinationName) {
            return [departureName, destinationName];
        }
    }
    return []
}

function getStaticLine(tripId) {
    if(!STOP_TIMES[tripId])
        return undefined;
    
    let times = Object.values(STOP_TIMES[tripId]);

    times.sort((a, b) => a.localeCompare(b));

    const data = [];
    for(let t of times) {
        let stopId = -1;
        for(let st of Object.keys(STOP_TIMES[tripId])) {
            if(STOP_TIMES[tripId][st] == t) {
                stopId = st;
                break;
            }
        }
        
        let departureTime = Math.floor(createDate(t.split(":")[0], t.split(":")[1], t.split(":")[2]).getTime() / 1000);
        
        let stationState = -1;
        var ti = departureTime - (Date.now() / 1000);
        if(ti > -20 && t < 17)
            stationState = 0;
        else if(ti > 17)
            stationState = 1;
        
        data.push({
            departure_time: departureTime.toString(),
            station_name: getStopName(stopId),
            state: stationState,
            vehicle_id: null,
            trip_id: tripId,
            route_id: TRIPS[tripId].route_id,
            route_short_name: TRIPS[tripId].trip_short_name,
            trip_color: getTripColor(tripId),
            schedule_relationship: 0,
            direction_id: -1,
            theoretical: true
        });
    }

    return data;
}

function getTripColor(tripId) {
    if(!TRIPS[tripId] || !ROUTES[TRIPS[tripId].route_id])
        return undefined;
    
    return ROUTES[TRIPS[tripId].route_id].route_color;
}

function getTripColorByRouteId(routeId) {
    if(!routeId || !ROUTES[routeId])
        return undefined;
    
    return ROUTES[routeId].route_color;
}

function getTrip(tripId) {
    return TRIPS[tripId];
}

function getServiceId(tripID) {
    if(TRIPS[tripID])
        return TRIPS[tripID].service_id
}

function getAllStops() {
    let stops = [];

    for(let s of Object.values(STOPS)) {
        if(!stops.includes(s.stop_name))
            stops.push(s.stop_name);
        
    }    
    return stops;
}

function getOtherDestinationsAndLines(stopName, deepSec) {
    let todayTrip = getTodayTrips();
    let serviceIds = [];
    let stopIds = getStopIds(stopName);

    let data = {};
    
    getTodayServices().forEach(e => {
        serviceIds.push(e.service_id);
    });

    let n = new Date();
    for(let tt of todayTrip) {
        for(let sti of stopIds) {
            if(TRIPS[tt.trip_id] && serviceIds.includes(TRIPS[tt.trip_id].service_id)) {  
                if(STOP_TIMES[tt.trip_id][sti]) {
                    let h = STOP_TIMES[tt.trip_id][sti].split(":")[0], m = STOP_TIMES[tt.trip_id][sti].split(":")[1], s = STOP_TIMES[tt.trip_id][sti].split(":")[2];
                    let c = createDate(h, m, s);
                    
                    let depDestName = getStaticDepartureDestinationName(tt.trip_id);
                    if(c.getTime() >= n.getTime() && c.getTime() - n.getTime() <= deepSec * 1000) {

                        let name = depDestName[1];

                        if(depDestName[0] == depDestName[1]) {
                            name += " " + (tt.direction_id==0?"A":"B");
                        }

                        if(!Object.keys(data).includes(name))
                            data[name] = [];
                        
                        let ok = true;
                        for(let directionData of data[name]) {
                            if(directionData.id == tt.route_id) {
                                ok = false;
                                break;
                            }
                        }
                        if(ok)
                            data[name].push({id: tt.route_id, short_name: getRouteShortName(tt.route_id), long_name: getRouteLongName(tt.route_id)});
                    }
                }
            }
        }
    }
    return data;
}

function getOtherTripIds(exculdeIds, deepSec, stopDatas) {    
    let todayTrip = getTodayTrips();
    let serviceIds = [];
    getTodayServices().forEach(e => {
        serviceIds.push(e.service_id);
    });

    const datas = [];

    let n = new Date();

    for(let tt of todayTrip) {
        for(let sti of Object.keys(stopDatas[0])) {            
            if(TRIPS[tt.trip_id] && serviceIds.includes(TRIPS[tt.trip_id].service_id)) {  
                let depDestName = getStaticDepartureDestinationName(tt.trip_id);

                if(STOP_TIMES[tt.trip_id][sti] === undefined 
                    || exculdeIds.includes(tt.trip_id) || datas.includes(tt.trip_id)) {
                    continue;
                }
                
                let ok = false;
                for(let routeId in stopDatas[1]) {
                    
                    if(routeId == TRIPS[tt.trip_id].route_id
                        && stopDatas[1][routeId].includes(depDestName[1].toUpperCase())
                    ) {  
                        ok = true;
                        break;
                    }
                }
                
                if(!ok)
                   continue;
               
                if(depDestName[0].toUpperCase() == depDestName[1].toUpperCase()) {
                    depDestName[1] += " " + (TRIPS[tt.trip_id].direction_id == 0?"A":"B");
                }
                
                let h = STOP_TIMES[tt.trip_id][sti].split(":")[0], m = STOP_TIMES[tt.trip_id][sti].split(":")[1], s = STOP_TIMES[tt.trip_id][sti].split(":")[2];
                let c = createDate(h, m, s);

                if(c.getTime() >= n.getTime() && c.getTime() - n.getTime() <= deepSec * 1000) {    
                    datas.push({
                        trip_headsign: depDestName[1],
                        departure_time: c.getTime().toString().substring(0, c.getTime().toString().length - 3),
                        route_short_name: getRouteShortName(tt.route_id),
                        route_long_name: getRouteLongName(tt.route_id),
                        vehicle_id: null,
                        trip_id: tt.trip_id,
                        trip_color: getTripColor(tt.trip_id),
                        modified: false,
                        theoretical: true
                    });
                }
            }
        }
    }

    return datas;
}

function createDate(h, m, s) {
	var time = new Date(0);
	time.setHours(h);
	time.setMinutes(m);
	time.setSeconds(s);

    let now = new Date();

    if(now.getHours() < 12) {
        if(time.getDate() > 1) {
            if(now.getHours() < time.getHours() || (now.getHours() == time.getHours() && now.getMinutes() <= time.getMinutes())) {
                now.setSeconds(time.getSeconds());
                now.setHours(time.getHours());
                now.setMinutes(time.getMinutes());
                return now;
            }else {
                return new Date(0);
            }

        }
    }

    if(time.getDate() > 1) {
        now.setSeconds(time.getSeconds());
        now.setHours(time.getHours());
        now.setMinutes(time.getMinutes());
        now.setDate(now.getDate() + 1);
        return now;
    }

    now.setSeconds(time.getSeconds());
    now.setHours(time.getHours());
    now.setMinutes(time.getMinutes());
    return now;
}

function getRouteId(tripId) {
    if(TRIPS[tripId] === undefined)
        return undefined;
    return TRIPS[tripId].route_id;
}

function getRouteIdByShortName(shortName) {
    if(shortName == undefined) {
        return undefined;
    }

    for(let route of Object.values(ROUTES)) {
        if(route.route_short_name == shortName)
            return route.route_id;
    }
}

function getRouteShortName(routeId) {
    if(routeId == undefined || ROUTES[routeId] == undefined)
        return undefined;

    return ROUTES[routeId].route_short_name;
}

function getRouteLongName(routeId) {
    if(routeId == undefined || ROUTES[routeId] == undefined)
        return undefined;

    return ROUTES[routeId].route_long_name;
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
    getOtherTripIds,
    getStaticLine,
    getTripColor,
    getTrip,
    getStaticDepartureDestinationName,
    getServiceId,
    getAllStops,
    getOtherDestinationsAndLines,
    getRouteId,
    getRouteShortName,
    getRouteLongName,
    getTripColorByRouteId,
    getRouteIdByShortName
};