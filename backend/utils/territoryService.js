const { Op } = require('sequelize');

const AREA_COORDINATES = [
  // Madurai North specific keywords
  { keywords: ['madurai north', 'anna nagar', 'k.k. nagar', 'sellur', 'goripalayam'], lat: 9.9252, lon: 78.1198, code: 'MDU-N', name: 'Madurai North', salesmanId: 8 },
  // Madurai South specific keywords
  { keywords: ['madurai south', 'thirumangalam', 'tirupparankundram', 'periyar', 'madurai'], lat: 9.9012, lon: 78.1100, code: 'MDU-S', name: 'Madurai South', salesmanId: 6 },
  // Trichy Central
  { keywords: ['trichy', 'tiruchirappalli', 'thillai nagar', 'srirangam'], lat: 10.7905, lon: 78.7047, code: 'TRI-C', name: 'Trichy Central', salesmanId: 8 },
  // Chennai Central
  { keywords: ['chennai', 'madras', 'adyar', 'mylapore', 't. nagar'], lat: 13.0827, lon: 80.2707, code: 'CHN-C', name: 'Chennai Central', salesmanId: 6 },
  // Coimbatore East
  { keywords: ['coimbatore', 'kovai', 'peelamedu', 'gandhipuram'], lat: 11.0168, lon: 76.9558, code: 'CBE-E', name: 'Coimbatore East', salesmanId: 8 },
  // Kumbakonam Central
  { keywords: ['kumbakonam'], lat: 10.9602, lon: 79.3845, code: 'KMU-C', name: 'Kumbakonam Central', salesmanId: 6 },
  // Perambalur Central
  { keywords: ['perambalur'], lat: 11.2342, lon: 78.8789, code: 'PER-C', name: 'Perambalur Central', salesmanId: 8 },
  // Thirunelveli Central
  { keywords: ['thirunelveli', 'tirunelveli', 'nellai'], lat: 8.7139, lon: 77.7567, code: 'TNV-C', name: 'Thirunelveli Central', salesmanId: 8 },
];

function geocodeAddress(address) {
  if (!address || typeof address !== 'string') return null;
  const addrLower = address.toLowerCase();

  for (const item of AREA_COORDINATES) {
    for (const kw of item.keywords) {
      if (addrLower.includes(kw)) {
        return { lat: item.lat, lon: item.lon, code: item.code, name: item.name };
      }
    }
  }
  return null;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return 0;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function resolveTerritoryAndSalesman(lat, lon, address = '') {
  let targetLat = lat !== null && lat !== undefined ? Number(lat) : null;
  let targetLon = lon !== null && lon !== undefined ? Number(lon) : null;

  if (targetLat === null || targetLon === null || isNaN(targetLat) || isNaN(targetLon)) {
    const geocoded = geocodeAddress(address);
    if (geocoded) {
      targetLat = geocoded.lat;
      targetLon = geocoded.lon;
    } else {
      // Default fallback (Madurai North) if address has no keywords match
      targetLat = 9.9252;
      targetLon = 78.1198;
    }
  }

  // Find nearest territory
  let closestTerritory = AREA_COORDINATES[0];
  let minDistance = Infinity;

  for (const terr of AREA_COORDINATES) {
    const dist = haversineDistance(targetLat, targetLon, terr.lat, terr.lon);
    if (dist < minDistance) {
      minDistance = dist;
      closestTerritory = terr;
    }
  }

  return {
    latitude: targetLat,
    longitude: targetLon,
    territory: closestTerritory.name,
    routeZone: closestTerritory.code,
    assignedSalesmanId: closestTerritory.salesmanId
  };
}

function resolveByTerritoryName(name) {
  if (!name) return null;
  const match = AREA_COORDINATES.find(t => 
    t.name.toLowerCase() === name.toLowerCase() || 
    t.code.toLowerCase() === name.toLowerCase()
  );
  if (match) {
    return {
      latitude: match.lat,
      longitude: match.lon,
      territory: match.name,
      routeZone: match.code,
      assignedSalesmanId: match.salesmanId
    };
  }
  return null;
}

async function generateUniqueCustomerCode(CustomerModel, territoryCode, options = {}) {
  const transaction = options.transaction || null;
  const lastCust = await CustomerModel.findOne({
    where: {
      customerCode: {
        [Op.like]: `${territoryCode}-%`
      }
    },
    order: [['customerCode', 'DESC']],
    attributes: ['customerCode'],
    transaction
  });

  let runningNum = 1;
  if (lastCust && lastCust.customerCode) {
    const parts = lastCust.customerCode.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      runningNum = lastNum + 1;
    }
  }

  return `${territoryCode}-${String(runningNum).padStart(4, '0')}`;
}

module.exports = {
  AREA_COORDINATES,
  geocodeAddress,
  haversineDistance,
  resolveTerritoryAndSalesman,
  resolveByTerritoryName,
  generateUniqueCustomerCode
};
