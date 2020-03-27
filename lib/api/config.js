// Mendo.org API Layer - Configuration
// Copyright (c) 2019 Joseph Huckaby

var fs = require('fs');
var assert = require("assert");
var async = require('async');
var Class = require('class-plus');
var Tools = require("pixl-tools");

module.exports = Class({
	
},
class Configuration {
	
	api_config(args, callback) {
		// send config to client
		var self = this;
		
		// do not cache this API response
		this.forceNoCacheResponse(args);
		
		var resp = {
			code: 0,
			version: this.server.__version,
			config: Tools.mergeHashes( this.config.get('client'), {
				debug: this.server.debug ? 1 : 0,
				default_privileges: this.usermgr.config.get('default_privileges'),
				free_accounts: this.usermgr.config.get('free_accounts'),
				external_users: this.usermgr.config.get('external_user_api') ? 1 : 0,
				external_user_api: this.usermgr.config.get('external_user_api') || '',
				email_from: this.config.get('email_from')
			} ),
			port: args.request.headers.ssl ? this.web.config.get('https_port') : this.web.config.get('http_port'),
			
			tags: this.tags,
			locations: this.locations,
			bans: this.bans,
			sorters: this.sorters
		};
		
		callback(resp);
	}
	
} );
