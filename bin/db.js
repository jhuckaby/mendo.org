#!/usr/bin/env node

// CLI for Unbase DB Search / Bulk Operations
// Copyright (c) 2020 Joseph Huckaby
// Released under the MIT License

// Usage:
//	./db.js "type:topic date:today"
//	./db.js "tags:offtopic" --update --tags "+something" --dry
//	./db.js "from:joe@mcn.org" --delete --dry

var path = require('path');
var cp = require('child_process');
var os = require('os');
var fs = require('fs');
var Request = require('pixl-request');

var cli = require('pixl-cli');
cli.global();

var Tools = cli.Tools;
var args = cli.args;

// chdir to the proper server root dir
process.chdir( path.dirname( __dirname ) );

// load app's config file
var config = require('../conf/config.json');
var web = config.WebServer;

var base_api_url = '';
if (web.https) {
	base_api_url = 'https://localhost:' + web.https_port + '/api';
}
else {
	base_api_url = 'http://localhost:' + web.http_port + '/api';
}

var request = new Request( "Mendo.org DB CLI" );
request.setTimeout( 30 * 1000 );
request.setFollow( 5 );
request.setAutoError( true );
request.setKeepAlive( true );

// use internal API key (only works on localhost)
var opts = {
	headers: {
		'X-API-Key': "internal"
	},
	rejectUnauthorized: false
};

// parse args
var query = args.query || '';
delete args.query;

if (!query && args.other) {
	query = args.other.join(' ');
	delete args.other;
}

var action = args.action || 'search';
delete args.action;

if (args.update) {
	action = 'update';
	delete args.update;
}
else if (args.delete) {
	action = 'delete';
	delete args.delete;
}

var params = {
	query: query
};
var api_url = '';

switch (action) {
	case 'search': 
		api_url = base_api_url + '/app/search';
		params.compact = true;
		params.offset = args.offset || 0;
		params.limit = args.limit || 100;
		params.sort_by = args.sort_by || '_id';
		params.sort_dir = args.sort_dir || -1;
	break;
	
	case 'update':
		api_url = base_api_url + '/app/bulk';
		params.action = action;
		params.updates = Tools.copyHashRemoveKeys( args, { verbose:1, debug:1, dry:1 } );
		if (!Tools.numKeys(params.updates)) die("No parameters specified to update!\n");
		for (var key in params.updates) {
			if (typeof(params.updates[key]) == 'string') params.updates[key] = params.updates[key].trim();
		}
	break;
	
	case 'delete': 
		api_url = base_api_url + '/app/bulk';
		params.action = action;
	break;
} // switch action

if (args.dry || args.debug) {
	print("\n");
	print( bold("DRY RUN: Request Preview:") + "\n");
	print("API URL: " + api_url + "\n");
	print("JSON Params: " + JSON.stringify(params, null, "\t") + "\n");
	print("\n");
	process.exit(0);
}
else {
	verbose("API URL: " + api_url + "\n");
	verbose("JSON Params: " + JSON.stringify(params, null, "\t") + "\n");
	verbose("\n");
}

request.json( api_url, params, opts, function(err, resp, data, perf) {
	if (err) die("ERROR: " + err + "\n");
	verbose("Status: " + resp.statusCode + " " + resp.statusMessage + "\n");
	verbose("Performance: " + JSON.stringify( perf.metrics() ) + "\n\n");
	
	print( JSON.stringify(data, null, "\t") + "\n\n" );
});
