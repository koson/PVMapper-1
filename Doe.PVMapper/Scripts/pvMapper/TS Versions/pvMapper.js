/// <reference path="_frameworkobjects.d.ts" />
/// reference path="../../_references.js" />
/// <reference path="Event.ts" />
var pvMapper;
(function (pvMapper) {
    var pvM = pvMapper;
    ; ;
    var Site = pvMapper.Site;
    ; ;
    var Event = pvMapper.Event;
    ; ;
    pvMapper.readyEvent = new pvM.Event(false);
    function onReady(fn) {
        this.readyEvent.addHandler(fn);
        return pvMapper;
    }
    pvMapper.onReady = onReady;
    var SiteManager = (function () {
        function SiteManager() {
            this.siteAdded = new pvM.Event();
            this.siteRemoved = new pvM.Event();
            this.sites = [];
        }
        SiteManager.prototype.getSites = function () {
            return this.sites;
        };
        SiteManager.prototype.getSite = function (index) {
            return this.sites[index];
        };
        SiteManager.prototype.addSite = function (site) {
            if(site instanceof OpenLayers.Feature) {
                //Convert the feature to a site
                site = new pvMapper.Site(site);
            } else {
                if(site instanceof pvMapper.siteOptions) {
                } else {
                    if(!site instanceof Site) {
                        //If the site was not one of the above and also is not a site then error
                        console.log("Cannot create a site from a type : " + typeof (site) + " Site not created.");
                    }
                }
            }
            this.sites.push(site);
            this.siteAdded.fire(site, [
                {
                    site: site
                }, 
                site
            ]);
        };
        SiteManager.prototype.removeSite = function (site) {
        }//Handles the change event for the features on the sitelayer. Will fire the sites change event if the
        //  feature that changed is a project site
        //@Parameter event {OpenLayers.Event object with a feature property that is a reference to the feature that changed
        //@See http://dev.openlayers.org/apidocs/files/OpenLayers/Layer/Vector-js.html#OpenLayers.Layer.Vector.events
        ;
        SiteManager.prototype.featureChangedHandler = function (event) {
            console.log("Feature change detected by the site manager");
            if(event.feature && event.feature.site) {
                try  {
                    event.feature.site.changeEvent.fire(this, event);
                    console.log("Fired the change event for site: " + event.feature.site.name);
                } catch (e) {
                    console.log("An error occurred while trying to fire the feature change event for a site from the site manager");
                    console.error(e);
                }
            }
        };
        return SiteManager;
    })();    
})(pvMapper || (pvMapper = {}));
