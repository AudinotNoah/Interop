<?php
require_once 'config.php';

$ip = $_SERVER['REMOTE_ADDR'];
$lat = null;
$lon = null;
$ville = "Localisation en cours...";
$region = "";
$source_geo = "IP";

if ($ip == '127.0.0.1' || $ip == '::1') {
    $ville_ip = "Localhost";
} else {
    $json_geo = chargerDonnees("http://ip-api.com/json/" . $ip);
    $geo_data = json_decode($json_geo, true);
    if ($geo_data && $geo_data['status'] == 'success') {
        $lat = $geo_data['lat'];
        $lon = $geo_data['lon'];
        $ville_ip = $geo_data['city'];
        $region = $geo_data['regionName'];
    } else {
        $ville_ip = "Indeterminee";
    }
}

if (stripos($ville_ip, 'Nancy') !== false && $lat !== null && $lon !== null) {
    $ville = $ville_ip;
} else {
    $url_iut = "https://api-adresse.data.gouv.fr/search/?q=2+Boulevard+Charlemagne+54000+Nancy&limit=1";
    $json_iut = chargerDonnees($url_iut);
    $data_iut = json_decode($json_iut, true);
    
    if ($data_iut && isset($data_iut['features'][0]['geometry']['coordinates'])) {
        $coords = $data_iut['features'][0]['geometry']['coordinates'];
        $lon = $coords[0];
        $lat = $coords[1];
        $ville = "IUT Charlemagne (Nancy)";
        $region = "Grand Est";
        $source_geo = "API Adresse";
    }
    
    if ($lat === null || $lon === null) {
        $lat = 48.6921;
        $lon = 6.1844;
        $ville = "IUT Charlemagne (Nancy)";
        $region = "Grand Est";
        $source_geo = "Coordonnées par défaut";
    }
}

$iut_lat = null;
$iut_lon = null;
$iut_url = "https://api-adresse.data.gouv.fr/search/?q=2+Boulevard+Charlemagne+54000+Nancy&limit=1";
$json_iut_poi = chargerDonnees($iut_url);
if ($json_iut_poi) {
    $data_iut_poi = json_decode($json_iut_poi, true);
    if ($data_iut_poi && isset($data_iut_poi['features'][0]['geometry']['coordinates'])) {
        $iut_lon = $data_iut_poi['features'][0]['geometry']['coordinates'][0];
        $iut_lat = $data_iut_poi['features'][0]['geometry']['coordinates'][1];
    }
}

$air_indice = "-";
$air_qualif = "Non dispo";
$air_color = "#95a5a6";
$air_source = "Data.gouv (ATMO)";
$cache_dir = 'cache';
$cache_air = $cache_dir . '/air_quality.csv';

if (!is_dir($cache_dir)) {
    mkdir($cache_dir, 0755, true);
}

if (!file_exists($cache_air) || (time() - filemtime($cache_air) > 3600)) {
    $url_dataset = "https://www.data.gouv.fr/api/1/datasets/indice-de-la-qualite-de-lair-quotidien-par-commune-indice-atmo/";
    $json_dataset = chargerDonnees($url_dataset);
    
    if ($json_dataset) {
        $dataset = json_decode($json_dataset, true);
        if ($dataset && isset($dataset['resources'])) {
            foreach ($dataset['resources'] as $resource) {
                if (isset($resource['format']) && strtolower($resource['format']) == 'csv') {
                    $csv_url_air = $resource['latest'] ?? $resource['url'] ?? null;
                    if ($csv_url_air) {
                        $csv_air = chargerDonnees($csv_url_air);
                        if ($csv_air && strlen($csv_air) > 1000) {
                            file_put_contents($cache_air, $csv_air);
                        }
                    }
                    break;
                }
            }
        }
    }
}

if (file_exists($cache_air)) {
    $handle = fopen($cache_air, "r");
    if ($handle) {
        $header = fgetcsv($handle, 0, ',', '"', '\\');
        $col_idx = array_flip($header);
        
        $idx_qual = $col_idx['code_qual'] ?? -1;
        $idx_lib = $col_idx['lib_qual'] ?? -1;
        $idx_zone = $col_idx['lib_zone'] ?? -1;
        $idx_coul = $col_idx['coul_qual'] ?? -1;
        $idx_date = $col_idx['date_ech'] ?? -1;
        
        if (preg_match('/\(([^)]+)\)/', $ville, $matches)) {
            $ville_search = trim($matches[1]);
        } else {
            $ville_search = trim($ville);
        }
        if (empty($ville_search) || $ville_search === 'Localisation en cours...') {
            $ville_search = 'Nancy';
        }
        
        while (($cols = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {
            if ($idx_zone >= 0 && isset($cols[$idx_zone]) && stripos($cols[$idx_zone], $ville_search) !== false) {
                $air_indice = $cols[$idx_qual] ?? '-';
                $air_qualif = $cols[$idx_lib] ?? 'Non dispo';
                if ($idx_coul >= 0 && isset($cols[$idx_coul])) {
                    $air_color = $cols[$idx_coul];
                }
                if ($idx_date >= 0 && isset($cols[$idx_date])) {
                    $air_source = "Data.gouv (" . substr($cols[$idx_date], 0, 10) . ")";
                }
                break;
            }
        }
        fclose($handle);
    }
}

$covid_dates = [];
$covid_values = [];
$covid_last_date = '';
$csv_url = 'https://www.data.gouv.fr/fr/datasets/r/2963ccb5-344d-4978-bdd3-08aaf9efe514'; 
$csv_content = chargerDonnees($csv_url);

if ($csv_content) {
    $lines = explode("\n", $csv_content);
    $data_points = [];
    $maxeville_col_idx = null;
    
    if (count($lines) > 0) {
        $header = str_getcsv($lines[0], ';', '"', '\\');
        if (count($header) < 3) $header = str_getcsv($lines[0], ',', '"', '\\');
        
        foreach ($header as $idx => $col) {
            if (stripos($col, 'MAXEVILLE') !== false) {
                $maxeville_col_idx = $idx;
                break;
            }
        }
        
        if ($maxeville_col_idx !== null) {
            for ($i = 1; $i < count($lines); $i++) {
                $line = trim($lines[$i]);
                if (empty($line)) continue;
                
                $cols = str_getcsv($line, ';', '"', '\\');
                if (count($cols) < 3) $cols = str_getcsv($line, ',', '"', '\\');
                
                if (isset($cols[0]) && isset($cols[$maxeville_col_idx])) {
                    $date_str = trim($cols[0]);
                    $val_str = trim($cols[$maxeville_col_idx]);
                    
                    if ($date_str !== '' && $val_str !== '' && $val_str !== 'NA' && stripos($val_str, 'NA') === false) {
                        $num_val = floatval(str_replace(',', '.', $val_str));
                        if ($num_val > 0) {
                            $data_points[$date_str] = $num_val;
                        }
                    }
                }
            }
        }
    }
    
    ksort($data_points);
    $data_points = array_slice($data_points, -10);
    $covid_last_date = '';
    foreach ($data_points as $d => $v) {
        $covid_dates[] = $d;
        $covid_last_date = $d;
        $covid_values[] = $v;
    }
}

$trafic_geojson = null;
$waze_url = 'https://carto.g-ny.org/data/cifs/cifs_waze_v2.json';
$waze_data = chargerDonnees($waze_url);

if ($waze_data) {
    $waze_json = json_decode($waze_data, true);
    
    if ($waze_json && isset($waze_json['incidents']) && is_array($waze_json['incidents'])) {
        $trafic_geojson = [
            'type' => 'FeatureCollection',
            'features' => []
        ];
        
        foreach ($waze_json['incidents'] as $incident) {
            $description = $incident['description'] ?? null;
            if (empty($description)) {
                $type = $incident['type'] ?? 'Incident';
                $subtype = $incident['subtype'] ?? '';
                $description = "$type : $subtype";
            }
            
            $coordinates = null;
            $loc = $incident['location'] ?? [];
            
            if (isset($loc['polyline'])) {
                if (is_array($loc['polyline']) && count($loc['polyline']) > 0) {
                    $firstPoint = $loc['polyline'][0];
                    if (isset($firstPoint['x']) && isset($firstPoint['y'])) {
                        $coordinates = [(float)$firstPoint['x'], (float)$firstPoint['y']];
                    } elseif (isset($firstPoint['lat']) && isset($firstPoint['lon'])) {
                        $coordinates = [(float)$firstPoint['lon'], (float)$firstPoint['lat']];
                    }
                } elseif (is_string($loc['polyline'])) {
                    $parts = preg_split('/\s+/', trim($loc['polyline']));
                    if (count($parts) >= 2) {
                        $coordinates = [(float)$parts[1], (float)$parts[0]];
                    }
                }
            }
            
            if (empty($coordinates) && isset($loc['lat'], $loc['lon'])) {
                $coordinates = [(float)$loc['lon'], (float)$loc['lat']];
            }
            
            if ($coordinates && count($coordinates) === 2) {
                $start = $incident['starttime'] ?? null;
                $end = $incident['endtime'] ?? null;
                $start_fmt = $start ? date('d/m/Y H:i', strtotime($start)) : null;
                $end_fmt = $end ? date('d/m/Y H:i', strtotime($end)) : null;
                
                $trafic_geojson['features'][] = [
                    'type' => 'Feature',
                    'geometry' => [
                        'type' => 'Point',
                        'coordinates' => $coordinates
                    ],
                    'properties' => [
                        'id' => $incident['id'] ?? uniqid(),
                        'type' => $incident['type'] ?? 'UNKNOWN',
                        'description' => $description,
                        'libelle' => $description,
                        'street' => $loc['street'] ?? 'Rue inconnue',
                        'level' => isset($incident['type']) && $incident['type'] == 'CONSTRUCTION' ? 'Chantier' : 'Incident',
                        'start_date' => $start_fmt,
                        'end_date' => $end_fmt
                    ]
                ];
            }
        }
    }
}

$html_meteo = "";
if (file_exists('xsl/meteo.xsl') && $lat !== null && $lon !== null) {
    $auth_token = "VU9fSA9xBiRfcgA3VyEKI1Y%2BUmcJf1B3VioLaABlUi8GbVc2AmJWMF4wAH0ALwI0UH0EZw80CTkKYQd%2FWigDYlU%2FXzMPZAZhXzAAZVd4CiFWeFIzCSlQd1YzC24Ac1IyBmFXLQJlVjJeLwBgADMCPlB8BHsPMQk2Cm8HZ1ozA2VVN185D2kGZF8vAH1XYQo3VmBSOwk0UDlWMgtuAG9SOAZmVzoCM1Y2Xi8AYAAwAjRQZQRhDzYJMgprB39aKAMZVUVfJg8sBiZfZQAkV3oKa1Y7UmY%3D";
    $checksum = "d5d7113365a5a0c1f587c23f7a8a04b9";
    $url_meteo = "http://www.infoclimat.fr/public-api/gfs/xml?_ll=" . $lat . "," . $lon . "&_auth=" . $auth_token . "&_c=" . $checksum;
    $xml_content = chargerDonnees($url_meteo);
    
    if ($xml_content && strpos(trim($xml_content), '<') === 0) {
        $xml = new DOMDocument();
        $xsl = new DOMDocument();
        
        libxml_use_internal_errors(true);
        if ($xml->loadXML($xml_content) && $xsl->load('xsl/meteo.xsl')) {
            $proc = new XSLTProcessor();
            $proc->importStyleSheet($xsl);
            $html_meteo = $proc->transformToXML($xml);
        } else {
            $html_meteo = "Erreur : Impossible de charger les données météo.";
        }
        libxml_clear_errors();
    } else {
        $html_meteo = "Erreur : API Infoclimat indisponible.";
    }
} else {
    $html_meteo = "Erreur : Fichier XSL manquant ou coordonnées invalides.";
}
?>

<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Atmosphère Grand Est</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="css/style.css" />
</head>
<body>

<div class="container">
    <h1>Atmosphère Grand Est</h1>
    <div class="info-loc">
        Localisation : <strong><?php echo $ville; ?></strong> (<?php echo $source_geo; ?>)
    </div>

    <div class="section-title">Prévisions Météo</div>
    <div><?php echo $html_meteo; ?></div>

    <div class="section-title">Trafic & Points d'intérêt</div>
    <div id="map"></div>
    <div class="legend">
        <span style="color:#ff7800">●</span> Chantiers | 
        <span style="color:#e60000">●</span> Incidents |
        <span style="color:#9b59b6">📍</span> IUT Charlemagne
    </div>

    <div class="grid">
        <div class="card">
            <div class="section-title">Données Covid (Eaux usées)</div>
            <p>Station : Nancy-Maxéville (Obépine)<?php if (!empty($covid_last_date)): ?> — <small>Dernière donnée : <?php echo $covid_last_date; ?></small><?php endif; ?></p>
            <div class="chart-container">
                <canvas id="covidChart"></canvas>
            </div>
        </div>
        <div class="card">
            <div class="section-title">Qualité de l'air</div>
            <div style="background-color: <?php echo $air_color; ?>; color: white; padding: 20px; border-radius: 8px; text-align: center;">
                <span style="font-size: 2em; font-weight: bold;"><?php echo $air_qualif; ?></span><br>
                <span>Indice ATMO : <strong><?php echo $air_indice; ?></strong></span><br>
                <small style="opacity: 0.8;">Source : <?php echo $air_source; ?></small>
            </div>
        </div>
    </div>

    <footer>
        <b>Sources des données (URLs complètes des APIs)</b><br>
        <small>
        Géolocalisation IP : <a href="http://ip-api.com/json/">http://ip-api.com/json/{ip}</a><br>
        API Adresse (IUT) : <a href="https://api-adresse.data.gouv.fr/search/?q=2+Boulevard+Charlemagne+54000+Nancy&limit=1">https://api-adresse.data.gouv.fr/search/?q=2+Boulevard+Charlemagne+54000+Nancy&limit=1</a><br>
        Météo XML : <a href="http://www.infoclimat.fr/public-api/gfs/xml">http://www.infoclimat.fr/public-api/gfs/xml?_ll={lat},{lon}</a><br>
        Trafic : <a href="https://carto.g-ny.org/data/cifs/cifs_waze_v2.json">https://carto.g-ny.org/data/cifs/cifs_waze_v2.json</a><br>
        Covid (Eaux usées) : <a href="https://www.data.gouv.fr/fr/datasets/r/2963ccb5-344d-4978-bdd3-08aaf9efe514">https://www.data.gouv.fr/fr/datasets/r/2963ccb5-344d-4978-bdd3-08aaf9efe514</a><br>
        Qualité de l'air : <a href="https://www.data.gouv.fr/api/1/datasets/indice-de-la-qualite-de-lair-quotidien-par-commune-indice-atmo/">https://www.data.gouv.fr/api/1/datasets/indice-de-la-qualite-de-lair-quotidien-par-commune-indice-atmo/</a>
        </small>
        <br><br>
        <b>Dépôt Git :</b> <a href="https://github.com/AudinotNoah/Interop">https://github.com/AudinotNoah/Interop</a>
    </footer>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="js/script.js"></script>
<script>
var APP_DATA = {
    lat: <?php echo $lat; ?>,
    lon: <?php echo $lon; ?>,
    ville: "<?php echo addslashes($ville); ?>",
    iutLat: <?php echo $iut_lat ?? 'null'; ?>,
    iutLon: <?php echo $iut_lon ?? 'null'; ?>,
    trafic: <?php echo $trafic_geojson ? json_encode($trafic_geojson) : 'null'; ?>,
    covidDates: <?php echo json_encode($covid_dates); ?>,
    covidValues: <?php echo json_encode($covid_values); ?>
};

initMap(APP_DATA.lat, APP_DATA.lon, APP_DATA.ville, APP_DATA.iutLat, APP_DATA.iutLon, APP_DATA.trafic);
initCovidChart(APP_DATA.covidDates, APP_DATA.covidValues);
</script>
</body>
</html>
