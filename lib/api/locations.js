// Mendo.org API Layer - Locations (i.e. cities)
// Copyright (c) 2019 Joseph Huckaby
// Released under the MIT License

var fs = require('fs');
var assert = require("assert");
var async = require('async');
var Class = require('class-plus');
var Tools = require("pixl-tools");

module.exports = Class({
	
},
class Locations {
	
	api_get_locations(args, callback) {
		// get list of all locations
		var self = this;
		var params = args.params;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.storage.listGet( 'global/locations', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got location list
		} ); // loaded session
	}
	
	api_get_location(args, callback) {
		// get single location for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.storage.listFind( 'global/locations', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('location', "Failed to locate location: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, location: item });
			} ); // got location
		} ); // loaded session
	}
	
	api_create_location(args, callback) {
		// add new location
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			title: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.username = user.username;
			params.created = params.modified = Tools.timeNow(true);
			
			// location id must be unique
			if (Tools.findObject(self.locations, { id: params.id })) {
				return self.doError('location', "That Location ID already exists: " + params.id, callback);
			}
			if (Tools.findObject(self.tags, { id: params.id })) {
				return self.doError('location', "That Location ID already exists as a Tag ID: " + params.id, callback);
			}
			
			self.logDebug(6, "Creating new location: " + params.title, params);
			
			self.storage.listPush( 'global/locations', params, function(err) {
				if (err) {
					return self.doError('location', "Failed to create location: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created location: " + params.title, params);
				self.logTransaction('location_create', params.title, self.getClientInfo(args, { location: params }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/locations', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache locations: " + err);
						return;
					}
					self.locations = items;
					
					// update RAM cache containing full location regexp
					self.prepConfig();
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_location(args, callback) {
		// update existing location
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.modified = Tools.timeNow(true);
			
			self.logDebug(6, "Updating location: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/locations', { id: params.id }, params, function(err, location) {
				if (err) {
					return self.doError('location', "Failed to update location: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated location: " + location.title, params);
				self.logTransaction('location_update', location.title, self.getClientInfo(args, { location: location }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/locations', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache locations: " + err);
						return;
					}
					self.locations = items;
					
					// update RAM cache containing full location regexp
					self.prepConfig();
				});
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_location(args, callback) {
		// delete existing location
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(6, "Deleting location: " + params.id, params);
			
			self.storage.listFindDelete( 'global/locations', { id: params.id }, function(err, location) {
				if (err) {
					return self.doError('location', "Failed to delete location: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted location: " + location.title, location);
				self.logTransaction('location_delete', location.title, self.getClientInfo(args, { location: location }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/locations', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache locations: " + err);
						return;
					}
					self.locations = items;
					
					// update RAM cache containing full location regexp
					self.prepConfig();
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
	api_multi_update_loc(args, callback) {
		// update multiple locations in one call
		var self = this;
		var params = args.params;
		
		if (!params.items || !params.items.length) {
			return this.doError('session', "Request missing 'items' parameter, or has zero length.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			self.logDebug(9, "Performing multi-location update", params);
			
			// convert item array to hash for quick matches in loop
			var update_map = {};
			for (var idx = 0, len = params.items.length; idx < len; idx++) {
				var item = params.items[idx];
				if (item.id) update_map[ item.id ] = item;
			}
			
			self.storage.listEachPageUpdate( 'global/locations',
				function(items, callback) {
					// update page
					var num_updates = 0;
					
					for (var idx = 0, len = items.length; idx < len; idx++) {
						var item = items[idx];
						if (item.id && (item.id in update_map)) {
							Tools.mergeHashInto( item, update_map[item.id] );
							num_updates++;
						}
					}
					
					callback( null, !!num_updates );
				},
				function(err) {
					if (err) return callback(err);
					
					self.logDebug(6, "Successfully updated multiple locations");
					self.logTransaction('location_multi_update', '', self.getClientInfo(args, { 
						updated: Tools.hashKeysToArray( Tools.copyHashRemoveKeys(params.items[0], { id:1 }) ) 
					}));
					
					callback({ code: 0 });
					
					// update cache in background
					self.storage.listGet( 'global/locations', 0, 0, function(err, items) {
						if (err) {
							// this should never fail, as it should already be cached
							self.logError('storage', "Failed to cache locations: " + err);
							return;
						}
						self.locations = items;
						
						// update RAM cache containing full location regexp
						self.prepConfig();
					});
				}
			); // listEachPageUpdate
		}); // loadSession
	}
	
} );
