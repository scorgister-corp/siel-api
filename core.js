const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const ALL_DATA = require('./merged_data.json');
const DIRECTIONS = require('./directions.json');
const INFOS = require('./infos.json');

var tripUpdateFeed = undefined;
var tripLastUpdate = undefined;

var alertFeed = undefined;
var alertLastUpdate = undefined;

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

/** ---- **/

function getAllStops() {
    let allStop = ALL_DATA.map(objet => objet.stop_name);
    allStop = [...new Set(allStop)];

    allStop.sort();
    return allStop;
}

function getDirectionsAndLines(stopName) {
	var stop = DIRECTIONS[stopName];
	if(stop == null || stop == undefined)
		return null;
	
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

    for(let i = 0; i < tripUpdate.entity.length; i++) {
		let entity = tripUpdate.entity[i];
		if(entity.tripUpdate.trip.tripId && entity.tripUpdate.trip.tripId == tripId) {
			return entity.tripUpdate;
		}
	}
}

async function getTripIdByVehiculeId(vehiculeId) {
    let tripUpdate = await getLastTripUpdate();

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

    ALL_DATA.forEach(elt => {        
        if(stopName.toUpperCase() == elt.stop_name.toUpperCase()
            && directions.includes(elt.trip_headsign.toUpperCase())
            && lines.includes(elt.route_id.substring(elt.route_id.indexOf("-")+1, elt.route_id.length))) {
            datas[elt.stop_id] = {
                stop_name: elt.stop_name,
                direction: elt.trip_headsign,
                route_id: elt.route_id
            };

            if(!routeIds.includes(elt.route_id))
                routeIds.push(elt.route_id);
        }
    });
    return [datas, routeIds, directions];
}

function getStopName(stopId) {
    for(let i = 0; i < ALL_DATA.length; i++)
        if(ALL_DATA[i].stop_id == stopId)
            return ALL_DATA[i].stop_name;
    return undefined;
}

async function getTripInfo(tripId) {
    let trip = await getTripUpdate(tripId);

    if(trip == undefined)
        return null;

    const data = [];

    trip.stopTimeUpdate.forEach(elt => {
        var stopName = getStopName(elt.stopId);

        if(stopName == undefined) {
            return;
        }
        var t = elt.departure.time - (Date.now() / 1000);
        var stationState = -1;
        if(t > -20 && t < 17)
            stationState = 0;
        else if(t > 17)
            stationState = 1;

        data.push({
            departure_time: elt.departure.time.toString(),
            station_name: stopName,
            state: stationState,
            vehicle_id: (trip.vehicle!=null?trip.vehicle.id:null),
            trip_id: trip.trip.tripId,
            route_short_name: trip.trip.routeId.split('-')[1],
            schedule_relationship: elt.scheduleRelationship
        })
    });

    return data;
}

async function getTripUpdateData(stopDatas) {
    let tripUpdate = await getLastTripUpdate();

    if(tripUpdate == undefined)
        return null;

    const data = [];

    tripUpdate.entity.forEach(entity => {
        if(entity.tripUpdate.trip.scheduleRelationship == 3 || entity.tripUpdate.stopTimeUpdate.length == 0) {
            return;
        }
        

        if(!stopDatas[1].includes(entity.tripUpdate.trip.routeId) || !stopDatas[2].includes(getStopName(entity.tripUpdate.stopTimeUpdate[entity.tripUpdate.stopTimeUpdate.length-1].stopId).toUpperCase()))
            return;
        
        entity.tripUpdate.stopTimeUpdate.forEach(stopTime => {
            // The vehicle is proceeding in accordance with its static schedule of stops, although not necessarily according to the times of the schedule. 
            if(stopTime.scheduleRelationship == 0
                && stopDatas[0][stopTime.stopId] != undefined
                && stopTime.departure.time.toString() - new Date().getTime() / 1000 >= 0) { 

                data.push({
                    trip_headsign: getStopName(getTripHeadsigneStopId(entity.tripUpdate.stopTimeUpdate)),
                    departure_time: stopTime.departure.time.toString(),
                    route_short_name: entity.tripUpdate.trip.routeId.split('-')[1],
                    stop_name: stopDatas[0][stopTime.stopId].stop_name,
                    vehicle_id: (entity.tripUpdate.vehicle!=null?entity.tripUpdate.vehicle.id:null),
                    trip_id: entity.tripUpdate.trip.tripId,
                    theoretical: false
                });
            }
            
        });
        
    });

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

async function getAlerts(lines) {
    let alerts = await getLastAlert();

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