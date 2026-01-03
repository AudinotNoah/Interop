function initMap(lat, lon, ville, iutLat, iutLon, traficData) {
    var map = L.map('map').setView([lat, lon], 13);
    
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    L.marker([lat, lon]).addTo(map)
        .bindPopup("<b>" + ville + "</b>").openPopup();

    if (iutLat && iutLon) {
        var iutIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
        L.marker([iutLat, iutLon], {icon: iutIcon}).addTo(map)
            .bindPopup("<b>🎓 IUT Charlemagne</b><br><small>2 Boulevard Charlemagne<br>Via API Adresse</small>");
    }

    if (traficData && traficData.features && traficData.features.length > 0) {
        L.geoJSON(traficData, {
            pointToLayer: function(feature, latlng) {
                var isConstruction = feature.properties.type === 'CONSTRUCTION';
                var iconHtml = '<div style="background-color: ' + (isConstruction ? '#ff7800' : '#e60000') + '; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>';
                return L.marker(latlng, {
                    icon: L.divIcon({
                        className: 'traffic-marker',
                        html: iconHtml,
                        iconSize: [12, 12],
                        iconAnchor: [6, 6]
                    })
                });
            },
            onEachFeature: function(f, l) {
                var p = f.properties;
                var title = p.level || (p.type === 'CONSTRUCTION' ? 'Chantier' : 'Incident');
                var popup = "<b>" + title + "</b><br>" + (p.description || '');
                if (p.street && p.street !== 'Rue inconnue') {
                    popup += "<br><i>" + p.street + "</i>";
                }
                if (p.start_date) {
                    popup += "<br><small>Début : " + p.start_date + "</small>";
                }
                if (p.end_date) {
                    popup += "<br><small>Fin : " + p.end_date + "</small>";
                }
                l.bindPopup(popup);
            }
        }).addTo(map);
    }
}

function initCovidChart(dates, values) {
    new Chart(document.getElementById('covidChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'SARS-CoV-2',
                data: values,
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231,76,60,0.1)',
                fill: true
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false 
        }
    });
}
