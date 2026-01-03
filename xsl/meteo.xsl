<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="html" encoding="UTF-8" indent="yes"/>

    <xsl:template match="/">
        <div class="meteo-widget">
            <h3>Prévisions Météo (Infoclimat GFS)</h3>
            
            <xsl:choose>
                <xsl:when test="previsions/request_state = '200'">
                    <div class="previsions-container" style="display:flex; gap:15px; justify-content:center; flex-wrap:wrap;">
                        <xsl:apply-templates select="previsions/echeance[position() &lt;= 6]"/>
                    </div>
                    <p style="font-size:0.8em; color:#666; margin-top:10px; text-align:center;">
                        Modèle GFS - Run <xsl:value-of select="previsions/model_run"/>h
                    </p>
                </xsl:when>
                <xsl:otherwise>
                    <p style="color:red;">Erreur API Infoclimat (code: <xsl:value-of select="previsions/request_state"/>)</p>
                </xsl:otherwise>
            </xsl:choose>
        </div>
    </xsl:template>

    <xsl:template match="echeance">
        <xsl:variable name="tempK" select="temperature/level[@val='2m']"/>
        <xsl:variable name="tempC" select="format-number($tempK - 273.15, '0.0')"/>
        <xsl:variable name="humidity" select="humidite/level[@val='2m']"/>
        <xsl:variable name="wind" select="vent_moyen/level[@val='10m']"/>
        <xsl:variable name="clouds" select="nebulosite/level[@val='totale']"/>
        <xsl:variable name="rain" select="pluie"/>
        <xsl:variable name="snow" select="risque_neige"/>
        
        <div class="card" style="border:1px solid #ddd; padding:15px; border-radius:8px; text-align:center; background:#fff; min-width:130px;">
            <strong style="color:#0056b3; font-size:0.9em;">
                <xsl:value-of select="substring(@timestamp, 12, 5)"/>
            </strong>
            <br/>
            <span style="font-size:0.75em; color:#888;">
                <xsl:value-of select="substring(@timestamp, 6, 5)"/>
            </span>
            <br/>
            <span style="font-size:2em;">
                <xsl:choose>
                    <xsl:when test="$snow = 'oui'">❄️</xsl:when>
                    <xsl:when test="$rain &gt; 1">🌧️</xsl:when>
                    <xsl:when test="$rain &gt; 0">🌦️</xsl:when>
                    <xsl:when test="$clouds &gt; 70">☁️</xsl:when>
                    <xsl:when test="$clouds &gt; 30">⛅</xsl:when>
                    <xsl:otherwise>☀️</xsl:otherwise>
                </xsl:choose>
            </span>
            <br/>
            <span style="font-size:1.5em; font-weight:bold; color:#333;">
                <xsl:value-of select="$tempC"/>°C
            </span>
            <br/>
            <small style="color:grey; font-size:0.8em;">
                💧 <xsl:value-of select="format-number($humidity, '0')"/>%
            </small>
            <br/>
            <small style="color:grey; font-size:0.8em;">
                💨 <xsl:value-of select="format-number($wind * 3.6, '0')"/> km/h
            </small>
            <xsl:if test="$rain &gt; 0">
                <br/>
                <small style="color:#3498db; font-size:0.8em;">
                    🌧 <xsl:value-of select="$rain"/> mm
                </small>
            </xsl:if>
        </div>
    </xsl:template>
</xsl:stylesheet>
