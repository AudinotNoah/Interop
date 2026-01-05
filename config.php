<?php

$use_proxy = false;

$proxy_stream = 'tcp://www-cache:3128';
$proxy_curl = 'www-cache:3128';

$allowed_domains = [
    'ip-api.com',
    'api.cyclocity.fr',
    'data.gouv.fr',
    'infoclimat.fr',
    'opendatasoft.com',
    'carto.g-ny.org'
];

$opts = [
    'http' => [
        'timeout' => 15,
        'ignore_errors' => true,
        'header' => "User-Agent: EtudiantIUT/1.0\r\n"
    ],
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false
    ]
];

if ($use_proxy) {
    $opts['http']['proxy'] = $proxy_stream;
    $opts['http']['request_fulluri'] = true;
}

$context = stream_context_create($opts);

function chargerDonnees($url) {
    global $use_proxy, $proxy_curl, $context;
    
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_USERAGENT, 'iut');
        
        if ($use_proxy) {
            curl_setopt($ch, CURLOPT_PROXY, $proxy_curl);
        }
        
        $res = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        return ($res !== false && $http_code === 200) ? $res : false;
    } else {
        return @file_get_contents($url, false, $context);
    }
}
