<?php
require_once 'config.php';

header("Access-Control-Allow-Origin: *");

if (!isset($_GET['url'])) {
    http_response_code(400);
    echo "Paramètre 'url' manquant";
    exit;
}

$url = $_GET['url'];

// Vérifier domaine autorisé
$isAllowed = false;
foreach ($allowed_domains as $domain) {
    if (strpos($url, $domain) !== false) {
        $isAllowed = true;
        break;
    }
}

if (!$isAllowed) {
    http_response_code(403);
    echo "Domaine non autorisé: $url";
    exit;
}

// Utiliser la fonction centralisée
$data = chargerDonnees($url);

if ($data === false) {
    http_response_code(502);
    echo "Erreur lors de la récupération";
    exit;
}

// Détecter le type de contenu
if (strpos($url, '.json') !== false || strpos($url, 'json') !== false) {
    header("Content-Type: application/json; charset=utf-8");
} elseif (strpos($url, '.xml') !== false || strpos($url, 'xml') !== false) {
    header("Content-Type: application/xml; charset=utf-8");
} elseif (strpos($url, '.csv') !== false || strpos($url, 'csv') !== false) {
    header("Content-Type: text/csv; charset=utf-8");
} else {
    header("Content-Type: text/plain; charset=utf-8");
}

echo $data;
