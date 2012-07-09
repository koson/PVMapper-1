﻿/// <reference path="../OpenLayers.js" />
/// <reference path="../jquery-ui-1.8.11.js" />
/// <reference path="../jquery-ui-1.8.21.full.js" />
/// <reference path="../_references.js" />

//Brings up the SiteDetail tools
$().ready(function () {
    createMap('map');
    createToolbox();

    //Click test
    map.events.register('click', map, function (e) {
        if (debug) {
            debug.write(map.getLonLatFromViewPortPx(e.xy));
        }
    });
});

//Global Variabels
var map;
var polyLayer;

//Create the tool that draws and edits the polygon

//Create the tool that saves the polygon layer to the database

//Create the tool that will tell the user the area of the polygon

//Crate a tool that can turn the layers on and off

//Create the tool that can set the current layer opacity

//Create the map and set the map variable
function createMap(div) {
    //Create the openlayers map and allow overlays to be visible
    USBounds = new OpenLayers.Bounds(-14020385.47423, 2768854.9122167, -7435794.1105484, 6506319.8467284);
    map = new OpenLayers.Map(div, { allOverlays: true,
        maxExtent: USBounds,
        numZoomLevels: 4,
        restrictedExtent: USBounds,
        controls: []
    });
    map.addControls([
        new OpenLayers.Control.Navigation(),
        new OpenLayers.Control.Attribution(),
        new OpenLayers.Control.PanZoomBar()
    ]);

    //This is a hack I found for getting the OSM resolutions without having to do the math.
    //It would seem that Bing Maps uses the same resolution settings as OSM
    var resolutions = OpenLayers.Layer.Bing.prototype.serverResolutions.slice(4, 19);

    var osm = new OpenLayers.Layer.OSM("Street", null, { zoomOffset: 4, resolutions: resolutions });
    var osmVector = new OpenLayers.Layer();
    map.addLayers([osm]); //Base Layer

    polyLayer = new OpenLayers.Layer.Vector("Sites",
        {
            styleMap: new OpenLayers.StyleMap({
                'default': new OpenLayers.Style({
                    strokeColor: "red",
                    strokeWidth: 1,
                    fillColor: "red",
                    fillOpacity: .05
                })
            })
        }); //The editable poly layer for the user's site
    map.addLayer(polyLayer); //The editable layer

    map.zoomToMaxExtent();
    //    map.maxExtent = new OpenLayers.Bounds(-14020385.47423, 3081940.9800292, -6799838.0353038, 6506319.8467284);
    //    map.zoomToExtent(new OpenLayers.Bounds(-14020385.47423, 3081940.9800292, -6799838.0353038, 6506319.8467284));
    //    map.restictedExtent = mapBounds;

    //    polyLayer.addFeatures([
    //        new OpenLayers.Feature.Vector(USBounds.toGeometry())
    //    ]);
}

//Create the toolbox
function createToolbox(div) {
    //Create the toolbox and initialize all the tools

    var panel = document.getElementById("floating-toolbar");
    toolbox = new OpenLayers.Control.EditingToolbar(polyLayer, { div: panel });
    map.addControl(toolbox);

    //toolbox.dialog();
}