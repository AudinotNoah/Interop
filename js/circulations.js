document.addEventListener("DOMContentLoaded", init);

let weatherOk = false;
let airOk = false;
let bikesAvailable = 0;

async function init() {
    try {
        const geoRes = await fetch("proxy.php?url=" + encodeURIComponent("http://ip-api.com/json/"));
        if (!geoRes.ok) throw new Error("Erreur géolocalisation IP");
        const geo = await geoRes.json();
        const lat = geo.lat;
        const lon = geo.lon;
        const ville = geo.city || "Nancy";

        const map = L.map("map").setView([lat, lon], 14);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "© OpenStreetMap"
        }).addTo(map);
        
        const blueIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:#3498db; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
        L.marker([lat, lon], {icon: blueIcon}).addTo(map).bindPopup(`<b>📍 ${ville}</b><br>Votre position`).openPopup();

        await Promise.all([
            loadBikes(map),
            loadWeather(lat, lon),
            loadAirQuality(ville)
        ]);
        
        updateDecision();
    } catch (e) {
        console.error(e);
        document.getElementById("decision-text").textContent = "❌ Erreur de chargement des données";
    }
}

async function loadBikes(map) {
    try {
        const url = "https://api.cyclocity.fr/contracts/nancy/gbfs/gbfs.json";
        const res = await fetch(url);
        if (!res.ok) throw new Error("GBFS Nancy indisponible");
        const gbfs = await res.json();
        const infoUrl = gbfs.data.fr.feeds.find(f => f.name === "station_information").url;
        const statusUrl = gbfs.data.fr.feeds.find(f => f.name === "station_status").url;

        const [infoRes, statusRes] = await Promise.all([fetch(infoUrl), fetch(statusUrl)]);
        const info = await infoRes.json();
        const status = await statusRes.json();

        const statusById = {};
        status.data.stations.forEach(s => statusById[s.station_id] = s);

        let totalBikes = 0;
        info.data.stations.forEach(s => {
            const st = statusById[s.station_id];
            if (!st) return;
            
            totalBikes += st.num_bikes_available;
            
            let color = "#27ae60";
            if (st.num_bikes_available === 0) color = "#e74c3c";
            else if (st.num_bikes_available < 5) color = "#f39c12";
            
            const icon = L.divIcon({
                className: 'bike-marker',
                html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });
            
            L.marker([s.lat, s.lon], {icon: icon}).addTo(map)
                .bindPopup(`<b>🚲 ${s.name}</b><br>Vélos disponibles : <strong>${st.num_bikes_available}</strong><br>Places libres : <strong>${st.num_docks_available}</strong>`);
        });
        
        bikesAvailable = totalBikes;
    } catch (e) {
        console.error(e);
        document.getElementById("decision-text").textContent = "⚠️ Données vélos indisponibles";
    }
}

async function loadWeather(lat, lon) {
    const meteoDiv = document.getElementById("meteo");
    try {
        const token = "VU9fSA9xBiRfcgA3VyEKI1Y%2BUmcJf1B3VioLaABlUi8GbVc2AmJWMF4wAH0ALwI0UH0EZw80CTkKYQd%2FWigDYlU%2FXzMPZAZhXzAAZVd4CiFWeFIzCSlQd1YzC24Ac1IyBmFXLQJlVjJeLwBgADMCPlB8BHsPMQk2Cm8HZ1ozA2VVN185D2kGZF8vAH1XYQo3VmBSOwk0UDlWMgtuAG9SOAZmVzoCM1Y2Xi8AYAAwAjRQZQRhDzYJMgprB39aKAMZVUVfJg8sBiZfZQAkV3oKa1Y7UmY%3D";     
        const checksum = "d5d7113365a5a0c1f587c23f7a8a04b9"; 

        const url = `http://www.infoclimat.fr/public-api/gfs/xml?_ll=${lat},${lon}&_auth=${token}&_c=${checksum}`;
        const res = await fetch("proxy.php?url=" + encodeURIComponent(url));
        if (!res.ok) throw new Error("Météo indisponible via proxy");

        const xmlText = await res.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        const echeances = Array.from(xmlDoc.querySelectorAll("echeance"));
        let meteoHtml = '<div class="info-title">☀️ Météo</div><div class="meteo-items">';
        
        let hasRain = false;
        let hasStrongWind = false;
        let isCold = false;
        
        for (let i = 0; i < Math.min(4, echeances.length); i++) {
            const e = echeances[i];
            const tempNode = e.querySelector("temperature > level[val='2m']");
            const tempK = tempNode ? parseFloat(tempNode.textContent) : null;
            const tempC = tempK ? (tempK - 273.15).toFixed(1) : "--";
            
            const windNode = e.querySelector("vent_moyen > level[val='10m']");
            const windMs = windNode ? parseFloat(windNode.textContent) : 0;
            const windKmh = (windMs * 3.6).toFixed(0);
            
            const rainNode = e.querySelector("pluie");
            const rain = rainNode ? parseFloat(rainNode.textContent) : 0;
            
            const timestamp = e.getAttribute("timestamp") || "--";
            const hour = timestamp.substring(11, 16);
            
            if (rain > 0.5) hasRain = true;
            if (windMs > 8) hasStrongWind = true;
            if (tempK && tempK - 273.15 < 5) isCold = true;
            
            let icon = "☀️";
            if (rain > 1) icon = "🌧️";
            else if (rain > 0) icon = "🌦️";
            else if (windMs > 8) icon = "💨";
            
            meteoHtml += `<div class="meteo-item"><span class="meteo-hour">${hour}</span> ${icon} ${tempC}°C | 💨 ${windKmh} km/h</div>`;
        }
        meteoHtml += '</div>';
        meteoDiv.innerHTML = meteoHtml;
        
        weatherOk = !hasRain && !hasStrongWind && !isCold;
    } catch (e) {
        console.error(e);
        meteoDiv.innerHTML = '<div class="info-title">☀️ Météo</div><div class="info-content error">Indisponible</div>';
    }
}

async function loadAirQuality(ville) {
    const airDiv = document.getElementById("air");
    try {
        const datasetUrl = "https://www.data.gouv.fr/api/1/datasets/indice-de-la-qualite-de-lair-quotidien-par-commune-indice-atmo/";
        const res = await fetch("proxy.php?url=" + encodeURIComponent(datasetUrl));
        if (!res.ok) throw new Error("Dataset indisponible");
        
        const dataset = await res.json();
        let csvUrl = null;
        for (const resource of dataset.resources) {
            if (resource.format && resource.format.toLowerCase() === 'csv') {
                csvUrl = resource.latest || resource.url;
                break;
            }
        }
        
        if (!csvUrl) throw new Error("CSV non trouvé");
        
        const csvRes = await fetch("proxy.php?url=" + encodeURIComponent(csvUrl));
        if (!csvRes.ok) throw new Error("CSV indisponible");
        
        const csvText = await csvRes.text();
        const lines = csvText.split("\n").filter(l => l.trim() !== "");
        const headers = lines[0].split(",");
        
        const idxZone = headers.findIndex(h => /lib_zone/i.test(h));
        const idxQual = headers.findIndex(h => /code_qual/i.test(h));
        const idxLib = headers.findIndex(h => /lib_qual/i.test(h));
        const idxDate = headers.findIndex(h => /date_ech/i.test(h));
        const idxColor = headers.findIndex(h => /coul_qual/i.test(h));

        let found = null;
        const searchVille = ville.toLowerCase();
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",");
            if (cols[idxZone] && cols[idxZone].toLowerCase().includes(searchVille)) {
                found = {
                    indice: cols[idxQual] || "-",
                    qualif: cols[idxLib] || "Non dispo",
                    date: cols[idxDate] ? cols[idxDate].substring(0, 10) : "",
                    color: cols[idxColor] || "#95a5a6"
                };
                break;
            }
        }

        if (found) {
            const isGood = found.qualif.toLowerCase() === 'bon' || found.qualif.toLowerCase() === 'moyen';
            airOk = isGood;
            
            let iconClass = "air-icon-bad";
            let iconSymbol = "✕";
            const q = found.qualif.toLowerCase();
            if (q === 'bon') { iconClass = "air-icon-good"; iconSymbol = "✓"; }
            else if (q === 'moyen') { iconClass = "air-icon-medium"; iconSymbol = "~"; }
            else if (q === 'dégradé') { iconClass = "air-icon-degraded"; iconSymbol = "!"; }
            else if (q === 'mauvais') { iconClass = "air-icon-bad"; iconSymbol = "✕"; }
            else if (q === 'très mauvais') { iconClass = "air-icon-verybad"; iconSymbol = "✕✕"; }
            else if (q === 'extrêmement mauvais') { iconClass = "air-icon-extreme"; iconSymbol = "☠"; }
            
            airDiv.innerHTML = `
                <div class="info-title">Qualité de l'air</div>
                <div class="air-display">
                    <span class="air-icon ${iconClass}">${iconSymbol}</span>
                    <div class="air-badge" style="background:${found.color}">
                        <span class="air-qualif">${found.qualif}</span>
                        <span class="air-indice">ATMO ${found.indice}</span>
                    </div>
                </div>
                <small>Source : Data.gouv (${found.date})</small>
            `;
        } else {
            airDiv.innerHTML = '<div class="info-title">Qualité de l\'air</div><div class="info-content">Données non disponibles</div>';
        }
    } catch (e) {
        console.error(e);
        airDiv.innerHTML = '<div class="info-title">Qualité de l\'air</div><div class="info-content error">Indisponible</div>';
    }
}

function updateDecision() {
    const decisionDiv = document.getElementById("decision-text");
    
    if (bikesAvailable === 0) {
        decisionDiv.innerHTML = "🚫 <strong>Pas de vélo disponible</strong> – Aucun vélo n'est disponible actuellement.";
        decisionDiv.parentElement.className = "decision-box bad";
    } else if (!weatherOk) {
        decisionDiv.innerHTML = "⚠️ <strong>Conditions météo défavorables</strong> – Pluie, vent fort ou froid prévu.";
        decisionDiv.parentElement.className = "decision-box warning";
    } else if (!airOk) {
        decisionDiv.innerHTML = "⚠️ <strong>Qualité de l'air dégradée</strong> – Évitez les efforts prolongés.";
        decisionDiv.parentElement.className = "decision-box warning";
    } else {
        decisionDiv.innerHTML = "✅ <strong>Conditions favorables !</strong> – C'est le moment idéal pour prendre un vélo.";
        decisionDiv.parentElement.className = "decision-box good";
    }
}
