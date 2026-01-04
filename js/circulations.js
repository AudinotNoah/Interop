document.addEventListener("DOMContentLoaded", init);

async function init() {
    try {
        const geoRes = await fetch("proxy.php?url=" + encodeURIComponent("http://ip-api.com/json/"));
        if (!geoRes.ok) throw new Error("Erreur géolocalisation IP");
        const geo = await geoRes.json();
        const lat = geo.lat;
        const lon = geo.lon;
        const ville = geo.city;

        const map = L.map("map").setView([lat, lon], 14);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "© OpenStreetMap"
        }).addTo(map);
        L.marker([lat, lon]).addTo(map).bindPopup(`<b>${ville}</b>`).openPopup();

        await loadBikes(map);
        await loadWeather(lat, lon);
        await loadAirQuality();
    } catch (e) {
        console.error(e);
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

        info.data.stations.forEach(s => {
            const st = statusById[s.station_id];
            if (!st) return;
            L.marker([s.lat, s.lon]).addTo(map)
                .bindPopup(`<b>${s.name}</b><br>Vélos : ${st.num_bikes_available}<br>Places : ${st.num_docks_available}`);
        });
    } catch (e) {
        console.error(e);
        document.getElementById("decision").textContent = "Les données vélos de Nancy ne sont pas disponibles.";
    }
}

async function loadWeather(lat, lon) {
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
        let meteoHtml = "";
        for (let i = 0; i < Math.min(7, echeances.length); i++) {
            const e = echeances[i];
            const tempNode = e.querySelector("temperature > level[val='2m']");
            const tempK = tempNode ? parseFloat(tempNode.textContent) : null;
            const tempC = tempK ? (tempK - 273.15).toFixed(1) : "--";
            const windNode = e.querySelector("vent_moyen > level[val='10m']");
            const wind = windNode ? windNode.textContent : "--";
            const rainNode = e.querySelector("pluie");
            const rain = rainNode ? rainNode.textContent : "--";
            const timestamp = e.getAttribute("timestamp") || e.getAttribute("hour") || "--";
            meteoHtml += `<b>${timestamp}</b> : ${tempC}°C, vent ${wind} km/h, pluie ${rain} mm<br>`;
        }
        document.getElementById("meteo").innerHTML = meteoHtml;
    } catch (e) {
        console.error(e);
        document.getElementById("meteo").textContent = "Météo indisponible";
    }
}

async function loadAirQuality() {
    try {
        const ville = "Nancy";
        const apiUrl = "https://www.data.gouv.fr/api/1/datasets/indice-de-la-qualite-de-lair-quotidien-par-commune-indice-atmo/exports/csv/";
        const res = await fetch("proxy.php?url=" + encodeURIComponent(apiUrl));
        if (!res.ok) throw new Error("Air data indisponible");

        const csvText = await res.text();
        const lines = csvText.split("\n").filter(l => l.trim() !== "");
        const headers = lines[0].split(",");
        const idxZone = headers.findIndex(h => /lib_zone/i.test(h));
        const idxQual = headers.findIndex(h => /code_qual/i.test(h));
        const idxLib = headers.findIndex(h => /lib_qual/i.test(h));
        const idxDate = headers.findIndex(h => /date_ech/i.test(h));

        let found = null;
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",");
            if (cols[idxZone] && cols[idxZone].toLowerCase() === ville.toLowerCase()) {
                found = {
                    indice: cols[idxQual] || "-",
                    qualif: cols[idxLib] || "Non dispo",
                    date: cols[idxDate] || ""
                };
                break;
            }
        }

        const airDiv = document.getElementById("air");
        if (found) {
            airDiv.innerHTML =
                `Qualité de l’air (${found.date}) : <strong>${found.qualif}</strong> (ATMO ${found.indice})`;
        } else {
            airDiv.textContent = "Qualité de l’air : données non disponibles pour Nancy";
        }
    } catch (e) {
        console.error(e);
        document.getElementById("air").textContent = "Qualité de l’air indisponible";
    }
}
