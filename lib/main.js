#!/usr/bin/env node

// Mendo.org Server - Main entry point
// Copyright (c) 2019 - 2020 Joseph Huckaby
// Released under the MIT License

var PixlServer = require("pixl-server");

// chdir to the proper server root dir
process.chdir( require('path').dirname( __dirname ) );

var server = new PixlServer({
	
	__name: 'Mendo',
	__version: require('../package.json').version,
	
	configFile: "conf/config.json",
	
	components: [
		require('pixl-server-storage'),
		require('pixl-server-unbase'),
		require('pixl-server-web'),
		require('pixl-server-api'),
		require('pixl-server-user'),
		require('./ml.js'),
		require('./engine.js'),
		require('./s3.js')
	]
	
});

server.startup( function() {
	// server startup complete
	process.title = server.__name + ' Server';
} );
