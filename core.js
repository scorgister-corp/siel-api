const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const gtfsRes = require("./gtfs-res");
const env = require("./env");
const fs = require("fs");

var tripUpdateFeed = undefined;
var tripLastUpdate = undefined;

var alertFeed = undefined;
var alertLastUpdate = undefined;

var vehicleFeed = undefined;
var vehiculeLastUpdate = undefined;

const ENV = env.loadFile("./.env");

if(!fs.existsSync("./infos.json")) {
    fs.writeFileSync("./infos.json", JSON.stringify({}));
}

const INFOS = JSON.parse(fs.readFileSync("./infos.json"));

async function getGTFSData(url) {
    let response = null;
    try {
        response = await fetch(
            url,
            {
                mode: 'cors',
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            },
        );
    }catch(e) {
        console.error("Error [1]");
        return undefined;
    }
    
    if (!response.ok) {
        const error = new Error(`${response.url}: ${response.status} ${response.statusText}`);
        error.response = response;
        throw error;
    }
    const buffer = await response.arrayBuffer();
    return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
}

async function getGTFSTripUpdate() {
    return getGTFSData(ENV["GTFS_TRIP_UPDATE_URL"]);
}

async function getGTFSAlert() {
    return getGTFSData(ENV["GTFS_ALERT_URL"]);
}

async function getGTFSVehiculePosition() {
    return getGTFSData(ENV["GTFS_VEHICULE_POSITION_URL"]);
}

async function getLastTripUpdate() {
    if(tripUpdateFeed == undefined || tripLastUpdate == undefined || new Date().getTime() - tripLastUpdate > 10 * 1000) {
        tripUpdateFeed = await getGTFSTripUpdate();
        tripLastUpdate = new Date().getTime();
    }
    
    return tripUpdateFeed;
}

async function getLastAlert() {
    if(alertFeed == undefined || alertLastUpdate == undefined || new Date().getTime() - alertLastUpdate > 20 * 1000) {
        alertFeed = await getGTFSAlert();
        alertLastUpdate = new Date().getTime();
    }    

    return alertFeed;
}

async function getLastVehiculePosition() {
    if(vehicleFeed == undefined || vehiculeLastUpdate == undefined || new Date().getTime() - vehiculeLastUpdate > 20 * 1000) {
        vehicleFeed = await getGTFSAlert();
        vehiculeLastUpdate = new Date().getTime();
    }

    return vehicleFeed;
}

/** ---- **/

function getAllStops() {
    let stops = gtfsRes.getAllStops();
    stops.sort();

    return stops;
}

async function getDirectionsAndLines(stopName) {
	let stop = {};
    let trip = await getLastTripUpdate();
    stop = gtfsRes.getOtherDestinationsAndLines(stopName, ENV.THEORETICAL_DEPTH);

    if(trip == undefined) {
        return {};
    }
    
    let stopIds = gtfsRes.getStopIds(stopName);
    
    for(let entity of trip.entity) {
        let ok = false;
        
        for(let st of entity.tripUpdate.stopTimeUpdate) {
            if(stopIds.includes(st.stopId)) {
                ok = true;
                break;
            }
        }

        if(!ok)
            continue;

        let destStop = entity.tripUpdate.stopTimeUpdate[entity.tripUpdate.stopTimeUpdate.length-1];
        let depStop = entity.tripUpdate.stopTimeUpdate[0];
        if(destStop == undefined || depStop == undefined)
            continue;


        let destName = gtfsRes.getStopName(destStop.stopId);
        let depName = gtfsRes.getStopName(depStop.stopId);
        
        let name = destName;
        if(destName == depName) {
            name += " " +  (entity.tripUpdate.trip.directionId==0?"A":"B");
        }
        
        if(!Object.keys(stop).includes(name))
            stop[name] = [];

        let routeId = "";
        if(entity.tripUpdate.trip.routeId == undefined || entity.tripUpdate.trip.routeId == "") {
            routeId = gtfsRes.getRouteId(entity.tripUpdate.trip.tripId);
        }else {
            routeId = entity.tripUpdate.trip.routeId;
        }

        if(routeId != undefined) {
            let ok = true;
            for(let directionData of stop[name]) {
                if(directionData.id == routeId) {
                    ok = false;
                    break;
                }
            }
            if(ok)
                stop[name].push({id: routeId, short_name: gtfsRes.getRouteShortName(routeId), long_name: gtfsRes.getRouteLongName(routeId)});
        }
    }

    return stop;
}

async function getVehiculeInfo(vehiculeId) {
	let data = INFOS[vehiculeId];
	if(data == null) {
		return null;
	}

	let trip = await getTripIdByVehiculeId(vehiculeId);
	data["trip_id"] = trip;
	return data;
}

async function getTripUpdate(tripId) {
    let tripUpdate = await getLastTripUpdate();

    if(tripUpdate == undefined) {
        return undefined;
    }
    
    for(let i = 0; i < tripUpdate.entity.length; i++) {
		let entity = tripUpdate.entity[i];        
		if(entity.tripUpdate.trip.tripId && entity.tripUpdate.trip.tripId == tripId) {
			return entity.tripUpdate;
		}
	}
}

async function getTripIdByVehiculeId(vehiculeId) {
    let tripUpdate = await getLastTripUpdate();

    if(tripUpdate == undefined)
        return undefined;

    for(let i = 0; i < tripUpdate.entity.length; i++) {
		let entity = tripUpdate.entity[i];
		if(entity.tripUpdate.vehicle && entity.tripUpdate.vehicle.id == vehiculeId) {
			return entity.tripUpdate.trip.tripId;
		}
	}
}

/**
 * 
 * @param {Object} stopNames 
 */
function getStopDatas(stopName, directions) {
    const datas = {};
            
    for(let routeId in directions)
        directions[routeId] = directions[routeId].map(function(x) {return x.toUpperCase();});

    gtfsRes.getStopIds(stopName).forEach(e => {        
        datas[e] = gtfsRes.getStopName(e)
    });
    return [datas, directions];
}

async function isTheoreticalTrip(tripId) {
    let trip = await getTripUpdate(tripId);

    return isTheorical(trip, tripId);
}

function isTheorical(trip, tripId) {
    if(trip == undefined || trip.stopTimeUpdate.length == 0)
        return true;
    
    let stopName = gtfsRes.getStopName(trip.stopTimeUpdate[trip.stopTimeUpdate.length-1].stopId);
    return trip.stopTimeUpdate.length <= 1 || (gtfsRes.getStaticDepartureDestinationName(tripId) != undefined && stopName !== undefined && stopName.toUpperCase() != gtfsRes.getStaticDepartureDestinationName(tripId)[1].toUpperCase());
}

async function getTripInfo(tripId) {
    let trip = await getTripUpdate(tripId);

    let data = [];
    let stops = []
    
    if(!(await isTheoreticalTrip(tripId))) {
        if(trip == undefined)
            return null;

        let tmpData = [];
        
        trip.stopTimeUpdate.forEach(elt => {
            var stopName = gtfsRes.getStopName(elt.stopId);
            
            if(stopName == undefined) {
                return;
            }
 
            let stationState = -1;
            let departureTime = "0";
            if(elt.scheduleRelationship == 0) {

                let arrivalOrDeparture = elt.departure;
                if(arrivalOrDeparture == undefined)
                    arrivalOrDeparture = elt.arrival;

                let  t = arrivalOrDeparture.time - (Date.now() / 1000);
                if(t > -20 && t < 17)
                    stationState = 0;
                else if(t > 17)
                    stationState = 1;

                departureTime = arrivalOrDeparture.time.toString();
                stops.push(stopName);
            }            
            let routeId = gtfsRes.getRouteId(trip.trip.tripId);
            if(routeId == undefined || routeId == "") {
                routeId = trip.trip.routeId;
            }

            tmpData.push({
                departure_time: departureTime,
                station_name: stopName,
                state: stationState,
                vehicle_id: getVehiculeId(trip),
                trip_id: trip.trip.tripId,
                route_id: routeId,
                route_short_name: gtfsRes.getRouteShortName(routeId),
                route_long_name: gtfsRes.getRouteLongName(routeId),
                trip_color: gtfsRes.getTripColorByRouteId(routeId),
                schedule_relationship: elt.scheduleRelationship,
                direction_id: trip.trip.directionId?.toString(),
                theoretical: false
            });
         
        });
                
        for(let d of tmpData) {
            if(d.schedule_relationship != 0 && stops.includes(d.station_name)) {
                continue;
            }
            
            data.push(d);
            stops.push(d.station_name);
        }

    }else {
        data = gtfsRes.getStaticLine(tripId);

        for(let d of data)
            if(d.theoretical)
                d.vehicle_id = getVehiculeId(await getTripUpdate(d.trip_id));
    }

    if(data && data.length > 0) {
        let now = new Date();
        let lastStop = data.length - 1;
        while(lastStop >= 0 && data[lastStop].schedule_relationship != 0) {
            lastStop--;
        }
        if(lastStop < 0)
            return [];
        
        if(data[lastStop].schedule_relationship != 0 || data[lastStop].departure_time - Math.floor(now.getTime() / 1000) + 60 < 0) {            
            return [];
        }
    }

    return data;
}

async function getTripUpdateData(stopDatas) {
    let tripUpdate = await getLastTripUpdate();

    if(tripUpdate == undefined)
        return null;
    
    let data = [];
    
    let tripIds = [];
    tripUpdate.entity.forEach(entity => {
    
        if(entity.tripUpdate.trip.scheduleRelationship == 3 || entity.tripUpdate.stopTimeUpdate.length == 0) {
            return;
        }

        let ok = false;
        
        for(let routeId in stopDatas[1]) {
            if(routeId == "empty"
                || (entity.tripUpdate.trip.routeId != undefined && routeId == entity.tripUpdate.trip.routeId)
                || ([undefined, ""].includes(entity.tripUpdate.trip.routeId) && routeId == gtfsRes.getRouteId(entity.tripUpdate.trip.tripId))) {
                    let destName = gtfsRes.getStopName(entity.tripUpdate.stopTimeUpdate[entity.tripUpdate.stopTimeUpdate.length-1].stopId)?.toUpperCase();
                    let depName = gtfsRes.getStopName(entity.tripUpdate.stopTimeUpdate[0].stopId)?.toUpperCase();
                    let name = destName;

                    if(depName == destName) {
                        name += " " + (entity.tripUpdate.trip.directionId==0?"A":"B");
                    }

                if(stopDatas[1][routeId].includes(name)) {
                    ok = true;
                    break
                }
            }
        }

        if(!ok)
            return;
        
        if(isTheorical(entity.tripUpdate, entity.tripUpdate.trip.tripId)) {
            return;
        }
    
        entity.tripUpdate.stopTimeUpdate.forEach(stopTime => {
            // The vehicle is proceeding in accordance with its static schedule of stops, although not necessarily according to the times of the schedule. 
            if(stopTime.scheduleRelationship == 0
                && stopDatas[0][stopTime.stopId] != undefined) {
                
                let arrivalOrDeparture = stopTime.departure;
                if(arrivalOrDeparture == undefined)
                    arrivalOrDeparture = stopTime.arrival;

               
                
                if(arrivalOrDeparture.time.toString() - Math.floor(new Date().getTime() / 1000).toString() >= 0) { 
                    
                    let destinationStopName = gtfsRes.getStopName(getTripHeadsigneStopId(entity.tripUpdate.stopTimeUpdate));
                    let departureStopName = gtfsRes.getStopName(getTripDepartureStopId(entity.tripUpdate.stopTimeUpdate));

                    if(departureStopName == destinationStopName) {
                        destinationStopName += " " + (entity.tripUpdate.trip.directionId == 0?"A":"B");
                    }

                    let routeId = gtfsRes.getRouteId(entity.tripUpdate.trip.tripId);
                    if(routeId == undefined || routeId == "") {
                        routeId = entity.tripUpdate.trip.routeId;
                    }
                    
                    data.push({
                        trip_headsign: destinationStopName,
                        departure_time: arrivalOrDeparture.time.toString(),
                        route_long_name: gtfsRes.getRouteShortName(routeId),
                        route_short_name: gtfsRes.getRouteShortName(routeId),
                        vehicle_id: getVehiculeId(entity.tripUpdate),
                        trip_id: entity.tripUpdate.trip.tripId,
                        trip_color: gtfsRes.getTripColorByRouteId(routeId),
                        theoretical: false
                    });
                }          
            }
            tripIds.push(entity.tripUpdate.trip.tripId);      
            
        });
        
    });
    
    
    const otherData = gtfsRes.getOtherTripIds(tripIds, ENV.THEORETICAL_DEPTH, stopDatas);
    
    for(let oD of otherData) {
        if(oD.theoretical)
            oD.vehicle_id = getVehiculeId(await getTripUpdate(oD.trip_id));
        data.push(oD);
    }
    
    data.sort((a, b) => a.departure_time.localeCompare(b.departure_time));

    return data;
}

function getVehiculeId(trip) {
    
    if(trip == undefined)
        return null;
    
    if(trip.vehicle != undefined)
        return trip.vehicle.id;
    return null;
}

function getTripHeadsigneStopId(stopTimeUpdate) {
    for(let i = stopTimeUpdate.length-1; i >= 0; i--) {        
        if(stopTimeUpdate[i].scheduleRelationship == 0) {
            return stopTimeUpdate[i].stopId;
        }
    }
    return undefined;
}

function getTripDepartureStopId(stopTimeUpdate) {
    for(let i = 0; i < stopTimeUpdate.length; i++) {        
        if(stopTimeUpdate[i].scheduleRelationship == 0) {
            return stopTimeUpdate[i].stopId;
        }
    }
    return undefined;
}

async function getAlerts(lines) {
    if(lines == undefined || lines == "") {
        return [];
    }

    let alerts = await getLastAlert();

    if(alerts == undefined) {
        return [];
    }

    const data = [];
    
    alerts.entity.forEach(alert => {      
        let conti = false;
        let routeId = 0;
        
        for(let entity of alert.alert.informedEntity) {            
            let rId = entity.routeId;
            
            if(lines.includes(rId)) {
                conti = true;
                routeId = rId;
                break;
            }
        }
        
        if(!conti)
            return;
        
        let trans = alert.alert.descriptionText.translation;
        for(let t of trans) {
            if(t.language == "fr") {
                data.push({
                    route_id: routeId,
                    route_short_name: gtfsRes.getRouteShortName(routeId),
                    text: t.text,
                    alert_id: alert.id
                });
            }
        }   
    });
    
    return data;
}

async function getUpdate(stopName, directions) {
    return await getTripUpdateData(getStopDatas(stopName, directions));
}

function getClientInfos() {
    return {transport_name: ENV.CLIENT_TRANSPORT_NAME, station_name: ENV.CLIENT_STATION_NAME, assets_url: ENV.CLIENT_ASSETS_URL};
}

module.exports = {
    getUpdate,
    getTripInfo,
    getAllStops,
    getDirectionsAndLines,
    getVehiculeInfo,
    getAlerts,
    getClientInfos
}