'use strict';

/*global require*/
var knockout = require('Cesium/ThirdParty/knockout');

var loadView = require('../Core/loadView');

var MenuBarViewModel = function() {
    this.items = [];

    knockout.track(this, ['items']);
};

MenuBarViewModel.prototype.show = function(container) {
    loadView(require('fs').readFileSync(__dirname + '/../Views/MenuBar.html', 'utf8'), container, this);
};

module.exports = MenuBarViewModel;
