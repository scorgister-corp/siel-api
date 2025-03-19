const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const ALL_DATA = require('./merged_data.json');
const DIRECTIONS = require('./directions.json');
const INFOS = require('./infos.json');
const gtfsRes = require("./gtfs-res");

var tripUpdateFeed = undefined;
var tripLastUpdate = undefined;

var alertFeed = undefined;
var alertLastUpdate = undefined;

var vehicleFeed = undefined;
var vehiculeLastUpdate = undefined;

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
    return getGTFSData('https://data.montpellier3m.fr/TAM_MMM_GTFSRT/TripUpdate.pb');
}

async function getGTFSAlert() {
    return getGTFSData('https://data.montpellier3m.fr/TAM_MMM_GTFSRT/Alert.pb');
}

async function getGTFSVehiculePosition() {
    return getGTFSData('https://data.montpellier3m.fr/TAM_MMM_GTFSRT/VehiclePosition.pb');
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
    stop = gtfsRes.getOtherDestinationsAndLines(stopName, 3600000);
    
    if(trip == undefined) {
        return {directions: [], lines: []};
    }
    
    let stopIds = gtfsRes.getStopIds(stopName);
    
    let destNames = [];
    let lineNames = [];
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

        let id = entity.tripUpdate.stopTimeUpdate[entity.tripUpdate.stopTimeUpdate.length-1];
        if(id == undefined)
            continue;

        let lineName = entity.tripUpdate.trip.routeId;
        lineName = lineName.split("-")[1];
        if(!lineNames.includes(lineName))
            lineNames.push(lineName);

        let name = gtfsRes.getStopName(id.stopId);
        if(!destNames.includes(name))
            destNames.push(name)
    }

    //let otherTrip = gtfsRes.getOtherTripIds([], 3600000, )
    for(let des of destNames) {
        if(!stop.directions.includes(des))
            stop.directions.push(des);
    }

    for(let li of lineNames) {
        if(!stop.lines.includes(li))
            stop.lines.push(li);
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
function getStopDatas(stopName, directions, lines) {
    const datas = {};
    const routeIds = [];

    directions = directions.map(function(x) {return x.toUpperCase();});

    gtfsRes.getStopIds(stopName).forEach(e => {        
        datas[e] = gtfsRes.getStopName(e)
    });
    return [datas, lines, directions];
}

function getStopName(stopId) {
    for(let i = 0; i < ALL_DATA.length; i++)
        if(ALL_DATA[i].stop_id.includes(stopId))
            return ALL_DATA[i].stop_name;
    return undefined;
}

async function isTheoreticalTrip(tripId) {
    let trip = await getTripUpdate(tripId);
    if(trip == undefined)
        return true;

    return trip.stopTimeUpdate.length <= 1 || (gtfsRes.getStaticDepartureDestinationName(tripId) != undefined && getStopName(trip.stopTimeUpdate[trip.stopTimeUpdate.length-1].stopId).toUpperCase() != gtfsRes.getStaticDepartureDestinationName(tripId)[1].toUpperCase());
}

async function getTripInfo(tripId) {
    let trip = await getTripUpdate(tripId);

    let data = [];
    let stops = []
    
    if(!(await isTheoreticalTrip(tripId))) {
        if(trip == undefined)
            return null;

        trip.stopTimeUpdate.forEach(elt => {
            var stopName = getStopName(elt.stopId);

            if(stopName == undefined || (elt.scheduleRelationship != 0 && stops.includes(stopName))) {
                return;
            }

            let stationState = -1;
            let departureTime = "0";
            if(elt.scheduleRelationship == 0) {
                var t = elt.departure.time - (Date.now() / 1000);
                if(t > -20 && t < 17)
                    stationState = 0;
                else if(t > 17)
                    stationState = 1;

                departureTime = elt.departure.time.toString();
            }

            data.push({
                departure_time: departureTime,
                station_name: stopName,
                state: stationState,
                vehicle_id: (trip.vehicle!=null?trip.vehicle.id:null),
                trip_id: trip.trip.tripId,
                route_short_name: trip.trip.routeId.split('-')[1],
                trip_color: gtfsRes.getTripColor(trip.trip.tripId),
                schedule_relationship: elt.scheduleRelationship,
                theoretical: false
            });
            stops.push(stopName);
        });
    }else {
        data = gtfsRes.getStaticLine(tripId);
    }

    if(data && data.length > 0) {
        let now = new Date();
        if(data[data.length-1].departure_time - Math.floor(now.getTime() / 1000) + 60 < 0) {
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
    let serviceIds = [];
    
    let tripIds = [];
    tripUpdate.entity.forEach(entity => {
        let sId = gtfsRes.getServiceId(entity.tripUpdate.trip.tripId);
        
        if(!serviceIds.includes(sId))
            serviceIds.push(sId);

        if(entity.tripUpdate.trip.scheduleRelationship == 3 || entity.tripUpdate.stopTimeUpdate.length == 0) {
            return;
        }

        if(!stopDatas[1].includes(entity.tripUpdate.trip.routeId.split('-')[1])
            || !stopDatas[2].includes(getStopName(entity.tripUpdate.stopTimeUpdate[entity.tripUpdate.stopTimeUpdate.length-1].stopId).toUpperCase())
        ) {  
            return;
        }
    
        entity.tripUpdate.stopTimeUpdate.forEach(stopTime => {
            // The vehicle is proceeding in accordance with its static schedule of stops, although not necessarily according to the times of the schedule. 
            if(stopTime.scheduleRelationship == 0
                && stopDatas[0][stopTime.stopId] != undefined) {
                if(stopTime.departure.time.toString() - Math.floor(new Date().getTime() / 1000).toString() >= 0) { 
                    
                    let destinationStopName = gtfsRes.getStopName(getTripHeadsigneStopId(entity.tripUpdate.stopTimeUpdate));
                    let departureStopName = gtfsRes.getStopName(getTripDepartureStopId(entity.tripUpdate.stopTimeUpdate));

                    if(departureStopName == destinationStopName) {
                        destinationStopName += " " + (entity.tripUpdate.trip.directionId == 0?"A":"B");
                    }
                    
                    data.push({
                        trip_headsign: destinationStopName,
                        departure_time: stopTime.departure.time.toString(),
                        route_short_name: entity.tripUpdate.trip.routeId.split('-')[1],
                        vehicle_id: (entity.tripUpdate.vehicle!=null?entity.tripUpdate.vehicle.id:null),
                        trip_id: entity.tripUpdate.trip.tripId,
                        trip_color: gtfsRes.getTripColor(entity.tripUpdate.trip.tripId),
                        theoretical: false
                    });
                }          
                tripIds.push(entity.tripUpdate.trip.tripId);      
            }
            
        });
        
    });
    
    
    const otherData = gtfsRes.getOtherTripIds(tripIds, 3600000, stopDatas);    
    for(let oD of otherData)
        data.push(oD);
    
    data.sort((a, b) => a.departure_time.localeCompare(b.departure_time));

    return data;
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
    let alerts = await getLastAlert();

    if(alerts == undefined) {
        return [];
    }

    const data = [];
    
    alerts.entity.forEach(alert => {      
        let conti = false;
        let routeId = 0;
        
        for(let entity of alert.alert.informedEntity) {            
            let rId = entity.routeId.substring(entity.routeId.indexOf("-") + 1, entity.routeId.length);
            
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
                    routeId: routeId,
                    text: t.text,
                    alert_id: alert.id
                });
            }
        }   
    });
    
    return data;
}

async function getUpdate(stopName, directions, lines) {
    return await getTripUpdateData(getStopDatas(stopName, directions, lines));
}

module.exports = {
    getUpdate,
    getTripInfo,
    getAllStops,
    getDirectionsAndLines,
    getVehiculeInfo,
    getAlerts
}