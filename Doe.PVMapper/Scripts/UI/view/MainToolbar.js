﻿

pvMapper.onReady(function () {

    function hasExtension(filename, extension) {
        // return true if the given filename uses the given file extension
        return filename.length < extension.length ? false :
            (filename.substr(filename.length - extension.length).toLowerCase() === extension.toLowerCase());
    }

    function ensureExtension(filename, extension) {
        // if the filename already ends with the given extension, return it without changes
        if (hasExtension(filename, extension))
            return filename;
        // if the filename doesn't end with the provided extension, return the filename with the extension appended onto it
        return filename + extension;
    }


    //----------------------------------------------------------------------------------------
    //#region Address Search
    // place name and address search box
    var searchComboBox = Ext.create('Heron.widgets.search.NominatimSearchCombo', {
        map: pvMapper.map,
        width: 400,
    });

    pvMapper.mapToolbar.add(9, searchComboBox);

    //#endregion
    //----------------------------------------------------------------------------------------
    //#region Navigation History

    // Navigation history - two "button" controls
    ctrl = new OpenLayers.Control.NavigationHistory();
    pvMapper.map.addControl(ctrl);

    action = Ext.create('GeoExt.Action', {
        text: "»",
        control: ctrl.next,
        disabled: true,
        tooltip: "Go to next map view extent"
    });
    pvMapper.mapToolbar.add(9, Ext.create('Ext.button.Button', action));

    action = Ext.create('GeoExt.Action', {
        text: "«",
        control: ctrl.previous,
        disabled: true,
        tooltip: "Go back to previous map view extent"
    });
    pvMapper.mapToolbar.add(9, Ext.create('Ext.button.Button', action));

    //#endregion
    //----------------------------------------------------------------------------------------
    //#region Measure distance tool
    var control = new OpenLayers.Control.Measure(OpenLayers.Handler.Path, {
        eventListeners: {
            measure: function (evt) {
                Ext.MessageBox.alert('Measure Distance', "The measurement was " + evt.measure.toFixed(2) + " " + evt.units);
                //alert("The measurement was " + evt.measure.toFixed(2) + " " + evt.units);
            }
        }
    });

    pvMapper.map.addControl(control);

    var distanceBtn = new Ext.Button({
        text: 'Measure Distance',
        enableToggle: true,
        //displaySystemUnits: ["mi","ft"],
        toggleGroup: "editToolbox",
        toggleHandler: function (buttonObj, eventObj) {
            if (buttonObj.pressed) {
                control.activate();
            } else {
                control.deactivate();
            }
        }
    });

    pvMapper.mapToolbar.add(3, distanceBtn);
    //#endregion
    //----------------------------------------------------------------------------------------
    //#region OpenFileDialog
    // add a button on the tool bar to launch a file picker to load local KML file.
    //first, create an input with type='file' and add it to the body of the page.
    var KMLMode = { KMLNONE: 0, KMLSITE: 1, KMLDISTANCE: 2, KMLINFO: 3 };
    KMLMode.CurrentMode = KMLMode.KMLNONE;
    var fileDialogBox = document.createElement('input');
    fileDialogBox.type = 'file';
    fileDialogBox.style = 'display:none';
    fileDialogBox.accept = "application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"; //only support in chrome and IE.  FF doesn't work.
    fileDialogBox.addEventListener('change', handleCustomKML, false);  // disable the distance KML event.

    document.body.appendChild(fileDialogBox);

    //listen to a file pick selection <OK> button on the file dialog box clicked.
    function handleCustomKML(evt) {
        if (!evt.target.files || !evt.target.files[0])
            return;

        var afile = evt.target.files[0];

        //we probably don't want to load hug file.  Limit is about 2MB.
        if (afile.size > 2000000) {
            Ext.MessageBox.confirm("File too big", "The file [" + afile.name + " with size: " + afile.size.toString() + "] is larger then 2000000 bytes (2 MB), do you want to continue loading?",
                function (btn) {
                    if (btn === 'yes') {
                        switch (KMLMode.CurrentMode) {
                            case KMLMode.KMLSITE:
                                continueHandlingSiteKML(afile);
                                break;
                            case KMLMode.KMLDISTANCE:
                                continueHandlingDistanceKML(afile);
                                break;
                            case KMLMode.KMLINFO:
                                continueHandlingInfoKML(afile);
                                break;
                        }
                    }
                });
        } else {
            switch (KMLMode.CurrentMode) {
                case KMLMode.KMLSITE:
                    continueHandlingSiteKML(afile);
                    break;
                case KMLMode.KMLDISTANCE:
                    continueHandlingDistanceKML(afile);
                    break;
                case KMLMode.KMLINFO:
                    continueHandlingInfoKML(afile);
                    break;
            }
        }
        fileDialogBox.value = "";
    }
    //#endregion OpenFileDialog
    //----------------------------------------------------------------------------------------
    //#region  KML Site Import
    function continueHandlingSiteKML(afile) {

        if (afile.type === "application/vnd.google-earth.kmz") {
            var reader = new FileReader();
            reader.onload = function (evt) { uncompressZip(evt.target.result, function (kmlResult) { importLocalSiteFromString(kmlResult, afile.name); }); }
            reader.readAsArrayBuffer(afile);
        } else if (afile.type === "application/vnd.google-earth.kml+xml") {
            var reader = new FileReader();
            reader.onload = function (evt) { importLocalSiteFromString(evt.target.result, afile.name); }
            reader.readAsText(afile);
        } else {
            Ext.MessageBox.alert("Unknown File Type", "The file [" + afile.name + "] is not a KML format.");
        }
    }

    function uncompressZip(kmzFile, kmlHandler) {
        try {
            var zip = new JSZip(kmzFile);
            // that, or a good ol' for(var entryName in zip.files)
            $.each(zip.files, function (index, zipEntry) {
                if (zipEntry.name.substr(zipEntry.name.length - '.kml'.length).toLowerCase() === '.kml') {
                    kmlHandler(zipEntry.asText() /*, zipEntry.name*/);
                }
            });
            // end of the magic !

        } catch (e) {
            Ext.MessageBox.alert("Compression Error", "The KMZ file could not be unzipped.");
        }
    }

    function importLocalSiteFromString(kmlString, kmlName) {
        var kml_projection = new OpenLayers.Projection("EPSG:4326");
        var map_projection = new OpenLayers.Projection("EPSG:3857");

        //var osm: OpenLayers.OSM = new OpenLayers.Layer.OSM();
        var kmlFormat = new OpenLayers.Format.KML({
            extractStyles: true,
            extractAttributes: true,
            internalProjection: map_projection,
            externalProjection: kml_projection
        });

        var features = kmlFormat.read(kmlString);
        var polyFeatures = [];
        var feature;
        while (feature = features.pop()) {
            if (feature.geometry.CLASS_NAME === "OpenLayers.Geometry.Polygon") {
                polyFeatures.push(feature);
            } else if (feature.geometry.CLASS_NAME === "OpenLayers.Geometry.Collection") {
                for (var i = 0; i < feature.geometry.components.length; i++) {
                    var subFeature = feature.clone();
                    subFeature.geometry = feature.geometry.components[i];
                    features.push(subFeature);  //note: append each collection component  onto the features to be recursively traverse.
                }
            }
        }

        if (polyFeatures.length >= 10) {
            Ext.MessageBox.confirm("Numerous Sites Warning", "There are more then 10 sites to add; do you want to add them anyway?",
                function (btn) {
                    if (btn === 'yes') {
                        for (var i = 0; i < polyFeatures.length; i++) {
                            AddSite(polyFeatures[i]);
                        }
                    }
                });
        } else if (polyFeatures.length <= 0) {
            Ext.MessageBox.alert("No Sites Found", "Failed to extract any KML polygons from the file provided.");
        } else {
            for (var i = 0; i < polyFeatures.length; i++) {
                AddSite(polyFeatures[i]);
            }
        }
    };

    ///kmlFeature : pvMapper.SiteFeature.
    function AddSite(kmlFeature) {
        var name = kmlFeature.attributes.name ? kmlFeature.attributes.name : "KML site";
        var desc = kmlFeature.attributes.description ? kmlFeature.attributes.description : "";

        kmlFeature.attributes.name = name;
        kmlFeature.attributes.description = desc;

        WKT = kmlFeature.geometry.toString();

        //adding the site to the server database.
        pvMapper.postSite(name, desc, WKT)
            .done(function (site) {
                kmlFeature.fid = site.siteId;
                kmlFeature.style = null;

                pvMapper.siteLayer.addFeatures([kmlFeature]);

                //push the new site into the pvMapper system
                var newSite = new pvMapper.Site(kmlFeature);
                pvMapper.siteManager.addSite(newSite);

                if (console) console.log('Added ' + newSite.name + ' from KML to the site manager');
            })
            .fail(function () {
                if (console) console.log('failed to post KML site');
                kmlFeature.destroy();
            });
    }

    var siteImportAction = Ext.create('Ext.Action', {
        text: 'Load Sites from KML',
        iconCls: 'x-open-menu-icon',
        tooltip: "Import site polygons from a KML file",
        handler: function () {
            fileDialogBox.value = ''; // this allows us to select the same file twice in a row (and still fires the value changed event)
            KMLMode.CurrentMode = KMLMode.KMLSITE;
            fileDialogBox.click();
        }
    });
    pvMapper.sitesToolbarMenu.add('-');
    pvMapper.sitesToolbarMenu.add(siteImportAction);
    //#endregion KML Site import
    //----------------------------------------------------------------------------------------
    //#region export site to KML
    function ExportToXML() {
        var kml_projection = new OpenLayers.Projection("EPSG:4326");
        var map_projection = new OpenLayers.Projection("EPSG:3857");

        var kmlFormat = new OpenLayers.Format.KML({
            extractStyles: false,
            extractAttributes: true,
            internalProjection: map_projection,
            externalProjection: kml_projection
        });

        var sitesKml = kmlFormat.write(pvMapper.siteLayer.features);
        SaveAsFile(sitesKml);
    }

    var previousFilenameForSavingSites = 'PVMapper Sites'
    function SaveAsFile(content) {

        // add a button on the tool bar to launch a file picker to load local KML file.
        //first, create an input with type='file' and add it to the body of the page.
        Ext.MessageBox.prompt('Save file as', 'Please enter a filename for the export sites.',
            function (btn, filename) {
                if (btn === 'ok') {
                    previousFilenameForSavingSites = (filename || 'PVMapper Sites')

                    //check to make sure that the file has '.kml' extension.
                    filename = ensureExtension(previousFilenameForSavingSites, '.kml');

                    var filenameSpecialChars = new RegExp("[~#%&*{}<>;?/+|\"]");
                    if (filename.match(filenameSpecialChars)) {
                        Ext.MessageBox.alert('Invlaid filename', 'A filename can not contains any of the following characters [~#%&*{}<>;?/+|\"]');
                        return;
                    }

                    var blob = CustomBlob(content, null);
                    blob.data = content;
                    blob.type = 'data:application/vnd.google-earth.kml+xml';
                    saveAs(blob, filename);
                }
            }, this, false, previousFilenameForSavingSites);

        //This code below works too, but always save with a file name of "Download.kml".
        //uriContent = 'data:application/vnd.google-earth.kml+xml;headers=Content-Disposition:attachment;filename="sites.kml",' + encodeURIComponent(content);
        //newWindow = window.open(uriContent, 'sites.kml');
    }

    var kmlExportBtn = Ext.create('Ext.Action', {
        text: 'Save Sites to KML',
        iconCls: 'x-save-menu-icon',
        tooltip: "Export site polygons and scores to a KML file",
        handler: function () {
            ExportToXML();
        }
    });
    pvMapper.sitesToolbarMenu.add(kmlExportBtn);
    //#endregion export site to KML
    //----------------------------------------------------------------------------------------
    //#region Save scoreboard
    var previousFilenameForSavingProject = 'PVMapper Project'
    function saveScoreboardAs() {

        // add a button on the tool bar to launch a file picker to load local KML file.
        //first, create an input with type='file' and add it to the body of the page.
        Ext.MessageBox.prompt('Save file as', 'Please enter a filename for the export sites (.pvProj).',
            function (btn, filename) {
                if (btn === 'ok') {
                    previousFilenameForSavingProject = (filename || 'PVMapper Project')

                    //check to make sure that the file has '.pvProj' extension..  We will check and add extension only if user did not provide or provided with wrong extension.
                    filename = ensureExtension(previousFilenameForSavingProject, '.pvProj');

                    var filenameSpecialChars = new RegExp("[~#%&*{}<>;?/+|\"]");
                    if (filename.match(filenameSpecialChars)) {
                        Ext.MessageBox.alert('Invlaid filename', 'A filename can not contains any of the following characters [~#%&*{}<>;?/+|\"]');
                        return;
                    }

                    var content = JSON.stringify(pvMapper.mainScoreboard);
                    var blob = CustomBlob(content, null);
                    blob.data = content;
                    blob.type = 'data:application/json';
                    saveAs(blob, filename);
                }
            }, this, false, previousFilenameForSavingProject);

    }

    var loadScoreboardBtn = Ext.create('Ext.Action', {
        text: 'Save Project',
        iconCls: 'x-saveproject-menu-icon',
        tooltip: "Save the Scoreboard project to local file.",
        handler: function () {
            saveScoreboardAs();
        }
    });
    pvMapper.scoreboardToolsToolbarMenu.add(0, loadScoreboardBtn);
    //#endregion Save scoreboard
    //----------------------------------------------------------------------------------------
    //#region Load scoreboard
    var fDialogBox = document.createElement('input');
    fDialogBox.type = 'file';
    fDialogBox.style = 'display:none';
    fDialogBox.accept = ".pvProj"; //only support in chrome and IE.  FF doesn't work.
    fDialogBox.addEventListener('change', handleLoadScoreboard, false);
    document.body.appendChild(fDialogBox);
    function handleLoadScoreboard(evt) {
        if (!evt.target.files || !evt.target.files[0])
            return;

        var afile = evt.target.files[0];
        var afilename = afile.name;


        //check to make sure that the file has '.kml' extension.
        var dotindex = afilename.lastIndexOf('.');
        dotindex = dotindex == -1 ? afilename.length : dotindex;
        var name = afilename.substr(0, dotindex, dotindex);
        var extension = afilename.replace(name, "");

        if (extension === ".pvProj") {
            var reader = new FileReader();
            reader.onload = function (evt) { importScoreboardFromJSON(evt.target.result); }
            reader.readAsText(afile);
        } else {
            Ext.MessageBox.alert("Unrecognize File Type", "The file [" + afile.name + "] is not a PVMapper project.");
        }
        fDialogBox.value = "";  //reset so we can open the same file again.
    }

    function AddScoreboardSite(aFeature) {
        WKT = aFeature.geometry.toString();

        //adding the site to the server database.
        pvMapper.postSite(aFeature.attributes.name, aFeature.attributes.description, WKT)
            .done(function (site) {
                aFeature.fid = site.siteId;

                pvMapper.siteLayer.addFeatures([aFeature]);

                //push the new site into the pvMapper system
                var newSite = new pvMapper.Site(aFeature);
                pvMapper.siteManager.addSite(newSite);

                if (console) console.log('Added ' + newSite.name + ' from Scoreboard Project to the site manager');
            })
            .fail(function () {
                if (console) console.log('failed to post Scoreboard site');
                aFeature.destroy();
            });
    }

    function importScoreboardFromJSON(scoreboardJSON) {
        var jsonObj = JSON.parse(scoreboardJSON);

        if ((jsonObj.scoreLines !== undefined) && (jsonObj.scoreLines.length > 0)) {
            //first remove all sites from sitelayer and from the database.

            var site, feature;
            var features = [];

            //change to use Promise pattern to better handle on syncing the delete and add project sites.
            //NOTE: Chrome 32+ supports Promise directly, all other browsers use an included promise.js library.
            var promise = new Promise(function removeSites(resolve, reject) {
                try {
                    //collecting all currently in memory features
                    while (site = pvMapper.siteManager.sites.pop()) {
                        pvMapper.deleteSite(site.id);
                        pvMapper.siteManager.removeSite(site);
                        var featureArray = pvMapper.siteLayer.features.filter(
                            function (a) {
                                return (a.attributes.name === site.name); //TODO: this is NOT a unique key !
                            });
                        console.assert(featureArray.length < 2, "Encountered a collision in tool names!");
                        var feature = featureArray.length ? featureArray[0] : null;
                        //This was what cause of the issue when loading project and report messed up.  The "find" function return "undefined" when no match found.  
                        //It test to be != null which always true and add all existing site information backin. 
                        if (feature)
                            features.push(feature);
                    }

                    //remove all site features found
                    pvMapper.siteLayer.removeFeatures(features, { silent: true });
                    pvMapper.siteManager.sites = [];  // reset, it seems re-using the existing sites array resulting in some error where GC is not collect fast enough.

                }
                catch (ex) {
                    reject(Error("Attempt delete sites failed, cause: " + ex.message));
                }

                resolve();
            }).then(
              function onDoneRemoveSites() {
                  //the scoreboard JSON object is in the following format, we need to search throught to find all features (polygons)
                  //root
                  //   |=scoreLines
                  //           |= Scores
                  //                  |= Scores
                  //                        |= Site
                  //                             |= geometry (features)
                  var allSites = [];
                  jsonObj.scoreLines.forEach(function (scline, scid) {
                      scline.scores.forEach(function (score, sid) {
                          var asiteArray = allSites.filter(
                              function (a)
                              {
                                  return (a.name === score.site.name); //TODO: this is NOT a unique key !
                              });
                          console.assert(asiteArray.length < 2, "Encountered a collision in site names!");
                          var asite = asiteArray.length ? asiteArray[0] : null;

                          console.assert(asite, "Wait... what is this function supposed to do? Because whatever that is, it's doing a bad job...")

                          if (!asite)
                              allSites.push(score.site);
                      });
                  });

                  //now add the project sites into siteLayer.
                  //var count = 0;
                  allSites.forEach(function (site, idx) {
                      feature = new OpenLayers.Feature.Vector(
                           OpenLayers.Geometry.fromWKT(site.geometry),
                           {
                               name: site.name,
                               description: site.description
                           },
                           pvMapper.siteLayer.style
                      );
                      AddScoreboardSite(feature);
                  });
              },
              function onerror(err) {
                  Ext.MessageBox.alert(err.message);
              }
            ).then(
            function onDoneAddSites() {
                //all scorelines (modules) should've been created.
                //update score in each scoreLine, if matched.
                jsonObj.scoreLines.forEach(function (line, idx) {
                    var scLineArray = pvMapper.mainScoreboard.scoreLines.filter(
                        function (a)
                        {
                            return (a.category === line.category) && (a.title === line.title); //TODO: this is NOT a unique key !
                        });
                    console.assert(scLineArray.length < 2, "Encountered a collision in score lines!");
                    var scLine = scLineArray.length ? scLineArray[0] : null;

                    if (typeof scLine === "object" && scLine) {
                        scLine.suspendEvent = true;
                        scLine.fromJSON(line);
                        scLine.suspendEvent = false;
                    }
                });

            },
            function onErrorDelete(err) {
                Ext.MessageBox.alert(err.message);
            }).then(function finished() {
                var bound = pvMapper.siteLayer.getDataExtent();
                pvMapper.map.zoomToExtent(bound, false);
            });

        }
        else {
            Ext.MessageBox.alert("Unrecognize data structure", "The file [" + afile.name + "] doesn't seems to be a PVMapper project file.");
        }
    }


    var loadScoreboardBtn = Ext.create('Ext.Action', {
        text: 'Load Project',
        iconCls: 'x-openproject-menu-icon',
        tooltip: "Load a saved scoreboard project and use it as a default.",
        handler: function () {
            fDialogBox.value = ''; // this allows us to select the same file twice in a row (and still fires the value changed event)
            fDialogBox.click();
        }
    });
    pvMapper.scoreboardToolsToolbarMenu.add(1, loadScoreboardBtn);

    //#endregion Load scoreboard
    //----------------------------------------------------------------------------------------
    //#region SaveScoreboardConfig
    var previousFilenameForSavingConfig = 'PVMapper Config';
    function saveScoreboardConfig() {
        Ext.MessageBox.prompt('Save file as', 'Please enter a configuraton filename (.pvCfg).',
            function (btn, filename) {
                if (btn === 'ok') {
                    previousFilenameForSavingConfig = (filename || 'PVMapper Config')

                    //check to make sure that the file has '.pvCfg' extension..  We will check and add extension only if user did not provide or provided with wrong extension.
                    filename = ensureExtension(previousFilenameForSavingConfig, '.pvCfg');

                    var filenameSpecialChars = new RegExp("[~#%&*{}<>;?/+|\"]");
                    if (filename.match(filenameSpecialChars)) {
                        Ext.MessageBox.alert('Invlaid filename', 'A filename can not contains any of the following characters [~#%&*{}<>;?/+|\"]');
                        return;
                    }

                    var config = { configLines: [] };
                    var aUtility, aStarRatables, aWeight, aTitle, aCat = null;

                    pvMapper.mainScoreboard.scoreLines.forEach(
                        function (scrline, idx, scoreLines) {
                            aUtility = scrline.scoreUtility;
                            aWeight = scrline.weight;
                            aTitle = scrline.title;
                            aCat = scrline.category;
                            aStarRatables = null;
                            if (scrline.getStarRatables !== undefined) {
                                aStarRatables = scrline.getStarRatables();
                            }
                            config.configLines.push({ title: aTitle, category: aCat, utility: aUtility, starRatables: aStarRatables, weight: aWeight });
                        });
                    var content = JSON.stringify(config);
                    var blob = CustomBlob(content, null);
                    blob.data = content;
                    blob.type = 'data:application/json';
                    saveAs(blob, filename);
                }
            }, this, false, previousFilenameForSavingConfig);
    }
    //----------------------------------------------------------------------------------------

    var saveConfigBtn = Ext.create('Ext.Action', {
        text: "Save Configuration",
        iconCls: "x-saveconfig-menu-icon",
        tooltip: "Save the Scoreboard Utility configuration to a local file.",
        handler: function () {
            saveScoreboardConfig();
        }
    });

    pvMapper.scoreboardToolsToolbarMenu.add(2, '-');
    pvMapper.scoreboardToolsToolbarMenu.add(3, saveConfigBtn);
    //#endregion SaveScoreboardConfig
    //----------------------------------------------------------------------------------------
    //#region LoadScoreboardConfig
    var configDialogBox = document.createElement('input');
    configDialogBox.type = 'file';
    configDialogBox.style = 'display:none';
    configDialogBox.accept = ".pvCfg"; //only support in chrome and IE.  FF doesn't work.
    configDialogBox.addEventListener('change', handleLoadScoreboardConfig, false);
    document.body.appendChild(configDialogBox);

    function handleLoadScoreboardConfig(evt) {
        if (!evt.target.files || !evt.target.files[0])
            return;

        var afile = evt.target.files[0];
        var afilename = afile.name;
        //check to make sure that the file has '.pvCfg' extension.
        var dotindex = afilename.lastIndexOf('.');
        dotindex = dotindex == -1 ? afilename.length : dotindex;
        var name = afilename.substr(0, dotindex, dotindex);
        var extension = afilename.replace(name, "");

        //since this feature is not support in FF, we need to check to make sure the file is correct extension.
        if (extension === ".pvCfg") {
            var reader = new FileReader();
            reader.onload = function (evt) { loadScoreboardConfig(evt.target.result); }
            reader.readAsText(afile);
        } else {
            Ext.MessageBox.alert("Unrecognize File Type", "The file [" + afile.name + "] is not a PVMapper configuration file.");
        }
        configDialogBox.value = "";

    }
    function loadScoreboardConfig(configJSON) {
        var obj = JSON.parse(configJSON);

        if ((obj.configLines !== undefined) && (obj.configLines.length > 0)) {
            //first remove all sites from sitelayer and from the database
            var scLine;
            obj.configLines.forEach(
                function (cfgLine, idx, configLines) {
                    var scLineArray = pvMapper.mainScoreboard.scoreLines.filter(
                        function (a)
                        {
                            return (a.category === cfgLine.category) && (a.title === cfgLine.title); //TODO: this is NOT a unique key !
                        });
                    console.assert(scLineArray.length < 2, "Encountered a collision in score lines!");
                    var scLine = scLineArray.length ? scLineArray[0] : null;

                    if (scLine)
                    {
                        scLine.updateConfiguration(cfgLine.utility, cfgLine.starRatables, cfgLine.weight);
                    }
                });
        }
        else {
            Ext.MessageBox.alert("Unrecognize structure", "The file [" + afile.name + "] doesn't seems to be a PVMapper configuration file.");
        }

    }

    //----------------------------------------------------------------------------------------
    var loadConfigBtn = Ext.create('Ext.Action', {
        text: "Load Configuration",
        iconCls: "x-openconfig-menu-icon",
        tooltip: "Load a Scoreboard Utility configuration from a local file.",
        handler: function () {
            configDialogBox.value = ''; // this allows us to select the same file twice in a row (and still fires the value changed event)
            configDialogBox.click();
        }
    });
    pvMapper.scoreboardToolsToolbarMenu.add(4, loadConfigBtn);
    //#endregion LoadScoreboardConfig
    //----------------------------------------------------------------------------------------
    //#region Reset scoreboard config
    function resetScoreboardConfig() {
        pvMapper.mainScoreboard.scoreLines.forEach(
            function (scrLine, idx, scoreLines) {
                scrLine.scoreUtility = scrLine.defaultScoreUtility;
                if ((scrLine.setStarRatables !== undefined) && (scrLine.getStarRatables !== undefined))
                    scrLine.setStarRatables(scrLine.getStarRatables("default"));
                scrLine.setWeight(10); //TODO: not all score lines have a default weight of 10.
                //TODO: some score lines have their own config menues, which should also be reset.
            });
    }

    var resetScoreboardBtn = Ext.create('Ext.Action', {
        text: 'Reset Configuration',
        iconCls: "x-cleaning-menu-icon",
        tooltip: "Reset the scoreboard to the default configuration",
        handler: function () {
            resetScoreboardConfig();
        }
    });
    pvMapper.scoreboardToolsToolbarMenu.add(5, resetScoreboardBtn);
    //#endregion
    //----------------------------------------------------------------------------------------
    //#region Export to Excel
    var previousFilenameForSavingCSV = 'PVMapper Scoreboard'
    function exportScoreboardToCSV() {
        Ext.MessageBox.prompt('Save file as', 'Please enter a filename for the scoreboard (.CSV).',
            function (btn, filename) {
                if (btn === 'ok') {
                    previousFilenameForSavingCSV = (filename || 'PVMapper Scoreboard')

                    //check to make sure that the file has '.csv' extension.  We just guard against wrong extension entered by user here.  Or if user not provided extension or mistype, we then add it here -- be smarter.
                    filename = ensureExtension(previousFilenameForSavingCSV, '.csv');

                    var filenameSpecialChars = new RegExp("[~#%&*{}<>;?/+|\"]");
                    if (filename.match(filenameSpecialChars)) {
                        Ext.MessageBox.alert('Invlaid filename', 'A filename can not contains any of the following characters [~#%&*{}<>;?/+|\"]');
                        return;
                    }

                    var exporter = Ext.create("GridExporter");

                    var content = exporter.getCSV(pvMapper.scoreboardGrid);
                    var blob = CustomBlob(content, null);
                    blob.data = content;
                    blob.type = 'data:application/csv';
                    saveAs(blob, filename);
                }
            }, this, false, previousFilenameForSavingCSV
        );
    }

    var exportBtn = Ext.create('Ext.Action', {
        text: "Export Scoreboard to CSV",
        iconCls: "x-fileexport-menu-icon",
        tooltip: "Export the scoreboard data to a CSV file.",
        handler: function () {
            exportScoreboardToCSV();
        }
    });
    pvMapper.scoreboardToolsToolbarMenu.add(6, exportBtn);

    //#endregion
    //----------------------------------------------------------------------------------------
    //#region Add distance score from KML
    function continueHandlingDistanceKML(afile) {
        var amoduleArray = pvMapper.customModules.filter(
            function (a)
            {
                return (a.fileName === afile.name); //TODO: this is NOT a unique key ! Also, this isn't a reasonable limitation or filter - users may have folder names to deliniate their files
            });
        console.assert(amoduleArray.length < 2, "Encountered a collision in file names!");
        var amodule = amoduleArray.length ? amoduleArray[0] : null;

        console.assert(amodule, "Wait... why is this function looking for a matching file? Because maybe it shouldn't...?");

        if (!amodule) {
            Ext.MessageBox.prompt("Module Naming", "Please type in the module name", function (btn, kmlModuleName) {
                if (btn == 'ok') {
                    if (kmlModuleName.length == 0)
                        kmlModuleName = afile.name;

                    //It seems HTML5 file API pull the file type from the MIME type association with an application.
                    //problem here is that if the client machine never had Google Earth installed, the file.type is blank.
                    //If it is the case, we can only realize on the file extension.
                    if (afile.type === "application/vnd.google-earth.kmz" || hasExtension(afile.name, ".kmz")) {
                        var localLayer = new INLModules.LocalLayerModule();
                        var reader = new FileReader();
                        reader.onload = function (evt) {
                            uncompressZip(evt.target.result,
                                function (kmlResult) {
                                    localLayer.readTextFile(kmlResult, kmlModuleName, afile.name);
                                    pvMapper.customModules.push(new pvMapper.CustomModuleData({ fileName: afile.name, moduleObject: localLayer }));
                                    saveToLocalDB(kmlModuleName, localLayer.moduleClass, afile.name, kmlResult); //TODO: we shouldn't use just the file name as the primary key here...
                                });
                        }
                        reader.readAsArrayBuffer(afile);
                    } else if (afile.type === "application/vnd.google-earth.kml+xml" || hasExtension(afile.name, ".kml")) {
                        var localLayer = new INLModules.LocalLayerModule();
                        var reader = new FileReader();
                        reader.onload = function (evt) {
                            localLayer.readTextFile(evt.target.result, kmlModuleName, afile.name);
                            pvMapper.customModules.push(new pvMapper.CustomModuleData({ fileName: afile.name, moduleObject: localLayer }));
                            saveToLocalDB(kmlModuleName, localLayer.moduleClass, afile.name, evt.target.result); //TODO: we shouldn't use just the file name as the primary key here...
                        }
                        reader.readAsText(afile);
                    } else {
                        Ext.MessageBox.alert("Unknown File Type", "The file [" + afile.name + "] is not a KML format.");
                    }
                }
            }, this, false, afile.name);
        }
        else {
            Ext.MessageBox.alert("Duplicate file", "The file [" + afile.name + "] was aleady loaded.");
        }
    }

    //create the actual button and put on the tool bar.
    var customTool = Ext.create('Ext.Action', {
        text: 'Add Distance Score From KML',
        iconCls: "x-open-menu-icon",
        tooltip: "Add a new layer using features from a KML file, and add a score line for the distance from each site to the nearest feature in the KML layer",
        //enabledToggle: false,
        handler: function () {
            fileDialogBox.value = ''; // this allows us to select the same file twice in a row (and still fires the value changed event)
            KMLMode.CurrentMode = KMLMode.KMLDISTANCE;
            fileDialogBox.click();
        }
    });
    pvMapper.scoreboardToolsToolbarMenu.add(7, '-');
    pvMapper.scoreboardToolsToolbarMenu.add(8, customTool);
    //#endregion Distance score from KML
    //----------------------------------------------------------------------------------------
    //#region Custom Info From KML
    function continueHandlingInfoKML(afile) {
        var moduleArray = pvMapper.customModules.filter(
            function (a)
            {
                return (a.fileName === afile.name); //TODO: this is NOT a unique key ! Also, this isn't a reasonable limitation or filter - users may have folder names to deliniate their files
            });
        console.assert(moduleArray.length < 2, "Encountered a collision in module names!");
        var module = moduleArray.length ? moduleArray[0] : null;

        console.assert(module, "Wait... why is this function looking for a matching module? Because maybe it shouldn't...?");

        if (!module) {
            Ext.MessageBox.prompt("Module Naming", "Please type in the module name", function (btn, kmlModuleName) {
                if (btn == 'ok') {
                    if (kmlModuleName.length == 0)
                        kmlModuleName = afile.name;

                    if (afile.type === "application/vnd.google-earth.kmz" || hasExtension(afile.name, ".kmz")) {
                        var infoLayer = new INLModules.KMLInfoModule();
                        var reader = new FileReader();
                        reader.onload = function (evt) {
                            uncompressZip(evt.target.result,
                                function (kmlResult) {
                                    infoLayer.readTextFile(kmlResult, kmlModuleName, afile.name);
                                    pvMapper.customModules.push(new pvMapper.CustomModuleData({ fileName: afile.name, moduleObject: infoLayer }));
                                    saveToLocalDB(kmlModuleName, infoLayer.moduleClass, afile.name, kmlResult); //TODO: we shouldn't use just the file name as the primary key here...
                                });
                        }
                        reader.readAsArrayBuffer(afile);
                    } else if (afile.type === "application/vnd.google-earth.kml+xml" || hasExtension(afile.name, ".kml")) {
                        var infoLayer = new INLModules.KMLInfoModule();
                        var reader = new FileReader();
                        reader.onload = function (evt) {
                            infoLayer.readTextFile(evt.target.result, kmlModuleName, afile.name);
                            pvMapper.customModules.push(new pvMapper.CustomModuleData({ fileName: afile.name, moduleObject: infoLayer }));
                            saveToLocalDB(kmlModuleName, infoLayer.moduleClass, afile.name, evt.target.result); //TODO: we shouldn't use just the file name as the primary key here...
                        }
                        reader.readAsText(afile);
                    } else {
                        Ext.MessageBox.alert("Unknown File Type", "The file [" + afile.name + "] is not a KML format.");
                    }
                }
            }, this, false, afile.name);
        }
        else {
            Ext.MessageBox.alert("Duplicate file", "The file [" + afile.name + "] was aleady loaded.");
        }
    }

    var customInfoTool = Ext.create('Ext.Action', {
        text: 'Add Info Layer From KML',
        iconCls: "x-open-menu-icon",
        tooltip: "Add a new layer using features from a KML file as a reference information.",
        //enabledToggle: false,
        handler: function () {
            fileDialogBox.value = ''; // this allows us to select the same file twice in a row (and still fires the value changed event)
            KMLMode.CurrentMode = KMLMode.KMLINFO;
            fileDialogBox.click();
        }
    });
    pvMapper.scoreboardToolsToolbarMenu.add(9, customInfoTool);
    //#endregion Custom info from KML
    //----------------------------------------------------------------------------------------
    //#region Save and Load Modules to local IndexedDB
    //Save the uploaded KML data to the client side database.
    //aname: string - the module name
    //aclass: string - the module class name.
    //akey: string - a unitue module key (a file name).
    //value: object - a string or object represent the actual module data.
    function saveToLocalDB(aname, aclass, akey, value) {
        pvMapper.ClientDB.saveCustomKML(aname, aclass, akey, value);
    }

    //load all saved uploaded KML modules.  This function is to be invoke by the scoreboard when everything is loaded.
    //the "pvMapper.isLocalModuleLoaded" prevent a session from loading one too many times.
    var isModulesLoading = false;
    pvMapper.loadLocalModules = function () {
        if (!pvMapper.isLocalModulesLoaded && !isModulesLoading) {
            isModulesLoading = true;
            pvMapper.ClientDB.getAllCustomKMLName(function (moduleFiles) {
                if ((moduleFiles) && (moduleFiles.length > 0)) {
                    moduleFiles.forEach(function (fileName, idx) {
                        pvMapper.ClientDB.loadCustomKML(fileName, function (moduleObj) {
                            if (moduleObj) {
                                var alayer = null;
                                if (moduleObj.customClass !== undefined) {
                                    if (moduleObj.customClass === "LocalLayerModule")
                                        alayer = new INLModules.LocalLayerModule();
                                    else if (moduleObj.customClass === "KMLInfoModule")
                                        alayer = new INLModules.KMLInfoModule();
                                }
                                if (alayer !== null) {
                                    alayer.readTextFile(moduleObj.customData, moduleObj.customName, fileName);
                                    pvMapper.customModules.push(new pvMapper.CustomModuleData({ fileName: fileName, moduleObject: alayer }));
                                }
                            }
                        });
                    });
                }
                pvMapper.isLocalModulesLoaded = true;
            });
        }
    }
    //#endregion Save/load modules
    //----------------------------------------------------------------------------------------


    var configTool = Ext.create('Ext.Action', {
        text: 'Tool Module Selector',
        iconCls: "x-tag-check-icon",
        tooltip: "Turn tool modules on and off.",
        //enabledToggle: false,
        handler: function () {
            var toolWin = Ext.create("MainApp.view.ToolConfigWindow", {
                buttons: [{
                    xtype: 'button',
                    text: 'Save',
                    tooltip:'Save the preferences to local database then close this window.',
                    handler: function () {
                        toolWin.closeMode = this.text;
                        toolWin.close();
                    }
                }, {
                    xtype: 'button',
                    text: "Close",
                    tooltip: 'Close without saving preference.  Current preferences are maintained in this session.',
                    handler: function () {
                        toolWin.closeMode = this.text;
                        toolWin.close();
                    }
                }]
            });
            toolWin.show();
        }
    });
    pvMapper.scoreboardToolsToolbarMenu.add(10, '-');
    pvMapper.scoreboardToolsToolbarMenu.add(11, configTool);

    var loadAllTool = Ext.create("Ext.Action", {
        text: "Load all tools",
        iconCls: 'x-tag-restart-icon',
        tooltip: "Get an update of all available tool modules.  If no new module after update, press F5 to refresh.",
        handler: function () {
            pvMapper.moduleManager.isLoadOnly = true;
            pvMapper.moduleManager.loadModuleScripts();
            pvMapper.moduleManager.isLoadOnly = false;
        }
    });
    pvMapper.scoreboardToolsToolbarMenu.add(12, loadAllTool);


});

