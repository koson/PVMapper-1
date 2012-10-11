﻿Ext.define( 'MainApp.view.Window', {
  extend: 'Ext.window.Window',
  alias: "pvWindow",
  layout: 'fit',
  title: null,
  //constrain: true,
  //renderTo: 'maincontent-body',
  autoShow: false,
  collapseMode: 'header',
  collapsible: true,
  bodyStyle: 'opacity: 1;',
  titleCollapse: true,
  collapse: function () {
    this.callParent( arguments );
    this.setWidth( this.getHeader().titleCmp.textEl.getWidth() );
  }
} ).callParent();
