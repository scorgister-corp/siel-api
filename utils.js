const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const ALLDATA = require('./merged_data.json');
const DIRECTIONS = require('./directions.json');

const all_data = ALLDATA;

function getTripHeadsign(stopName) {
	const tripHeadsigns = [];
	all_data.forEach(item => {
		if (item.stop_name === stopName) {
			tripHeadsigns.push(item.trip_headsign);
		}
	});
	const uniqueTripHeadsigns = tripHeadsigns.filter((value, index, self) => self.indexOf(value) === index);
	uniqueTripHeadsigns.sort();

	return uniqueTripHeadsigns.length ? uniqueTripHeadsigns : ['Stop non trouvé'];
}

function getDirections(stopName) {
	var stop = DIRECTIONS[stopName];
	if(stop == null || stop == undefined)
		return null;
	
	return stop["directions"];
}

function getLines(stopName) {
	var stop = DIRECTIONS[stopName];
	if(stop == null || stop == undefined)
		return null;
	
	return stop["lines"];
}

function getAllStops() {
	let allStop = all_data.map(objet => objet.stop_name);
	allStop = [...new Set(allStop)];
	allStop.sort();
	return allStop;
}

function timestampToTime(timestamp) {
	const date = new Date(timestamp.time * 1000);
	const hours = date.getHours();
	const minutes = `0${date.getMinutes()}`.slice(-2);
	const seconds = `0${date.getSeconds()}`.slice(-2);
	return `${hours}:${minutes}:${seconds}`;
}

function showTrip(tripData) {
	const data = all_data.find(item => item.trip_id.includes(tripData.tripId));
	if (data) {
		if (data.hasOwnProperty('trip_headsign') && data.trip_headsign !== '') {
			return data.trip_headsign;
		}
	}
	return 'Destination inconnue';
}

function searchStopAndDirection(stopName, direction) {
	const results = [];
	all_data.forEach(item => {
		for(var i = 0; i < direction.length; i++) {
			if(item.stop_name === stopName && item.trip_headsign === direction[i]) {
				results.push({
					stop_id: item.stop_id,
					route_id: item.route_id,
					trip_headsign: item.trip_headsign,
					stop_name: item.stop_name,
				});
			}
		}
	});

	return results;
}

async function findData(direction, line) {
	if(direction === undefined || direction.length === 0 || direction === null) {
		console.error("Error [0]");
		return null;
	}

	if(line === undefined || line.length === 0 || line === null) {
		console.error("Error [1]");
		return null;
	}
	var response = null;
	try {
		response = await fetch(
			'https://data.montpellier3m.fr/TAM_MMM_GTFSRT/TripUpdate.pb',
			{
				mode: 'cors',
				headers: {
					'Access-Control-Allow-Origin': '*',
				},
			},
		);
	}catch(e) {
		console.error("Error [2]");
		return null;
	}
	if (!response.ok) {
		const error = new Error(`${response.url}: ${response.status} ${response.statusText}`);
		error.response = response;
		throw error;
	}
	const buffer = await response.arrayBuffer();
		
	const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
	const data = [];
	
	feed.entity.forEach(entity => {				
		if(entity.tripUpdate) {
			for(var i = 0; i < direction.length; i++) {				
				for(var j = 0; j < line.length; j++) {					
					if(entity.tripUpdate.trip.routeId === direction[i].route_id && direction[i].route_id.endsWith("-" + line[j])) {
						if(entity.tripUpdate.stopTimeUpdate) {
							entity.tripUpdate.stopTimeUpdate.forEach(stop => {
								if(direction[i].stop_id === stop.stopId) {								
									if(stop.arrival && stop.arrival.time) {
										if(typeof stop.arrival.time.low === 'number' && stop.arrival.time > Date.now() / 1000) {
											if(entity.tripUpdate && entity.tripUpdate.trip) {
												const trip = showTrip(entity.tripUpdate.trip);
												if(trip === direction[i].trip_headsign) {
													data.push({
														trip_headsign: trip,
														departure_time: stop.arrival.time.toString(),
														route_short_name: direction[i].route_id.split('-')[1],
														stop_name: direction[i].stop_name
													});
												}
											}
										}
									}
								}
							});
						}
					}
				}
			}
		}
	});
	
	data.sort((a, b) => a.departure_time.localeCompare(b.departure_time));
	
	return data;
}

function toPascalCase(str) {
	return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

async function getData(stopName, direction, line) {
	let obj = await searchStopAndDirection(stopName, direction);
	if (obj.length === 0) {
		const new_stopName = toPascalCase(stopName);
		obj = await searchStopAndDirection(new_stopName, direction);
	}

	return await findData(obj, line);
}

module.exports = {
	getTripHeadsign,
	getAllStops,
	timestampToTime,
	showTrip,
	searchStopAndDirection,
	findData,
	toPascalCase,
	getData,
	getDirections,
	getLines
};
