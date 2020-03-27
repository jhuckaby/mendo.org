// Mendo.org API Layer - Sorters
// Copyright (c) 2020 Joseph Huckaby
// Released under the MIT License

var fs = require('fs');
var assert = require("assert");
var async = require('async');
var Class = require('class-plus');
var Tools = require("pixl-tools");

module.exports = Class({
	
},
class Sorters {
	
	api_get_sorters(args, callback) {
		// get list of all sorters
		var self = this;
		var params = args.params;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.storage.listGet( 'global/sorters', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got sorter list
		} ); // loaded session
	}
	
	api_get_sorter(args, callback) {
		// get single sorter for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.storage.listFind( 'global/sorters', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('sorter', "Failed to locate sorter: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, sorter: item });
			} ); // got sorter
		} ); // loaded session
	}
	
	api_create_sorter(args, callback) {
		// add new sorter
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			query: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.id = Tools.generateShortID('s');
			params.username = user.username;
			params.created = params.modified = Tools.timeNow(true);
			
			// id must be unique
			if (Tools.findObject(self.sorters, { id: params.id })) {
				return self.doError('sorter', "That Sorter ID already exists: " + params.id, callback);
			}
			
			// deleting will produce a "hole" in the sort orders, so we have to find the max + 1
			params.sort_order = -1;
			self.sorters.forEach( function(sorter_def) {
				if (sorter_def.sort_order > params.sort_order) params.sort_order = sorter_def.sort_order;
			});
			params.sort_order++;
			
			self.logDebug(6, "Creating new sorter: " + params.id, params);
			
			self.storage.listPush( 'global/sorters', params, function(err) {
				if (err) {
					return self.doError('sorter', "Failed to create sorter: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created sorter: " + params.id, params);
				self.logTransaction('sorter_create', params.id, self.getClientInfo(args, { sorter: params }));
				
				callback({ code: 0, sorter: params });
				
				// update cache in background
				self.storage.listGet( 'global/sorters', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache sorters: " + err);
						return;
					}
					self.sorters = items;
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_sorter(args, callback) {
		// update existing sorter
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
			
			self.logDebug(6, "Updating sorter: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/sorters', { id: params.id }, params, function(err, sorter) {
				if (err) {
					return self.doError('sorter', "Failed to update sorter: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated sorter: " + sorter.id, params);
				self.logTransaction('sorter_update', sorter.id, self.getClientInfo(args, { sorter: sorter }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/sorters', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache sorters: " + err);
						return;
					}
					self.sorters = items;
				});
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_sorter(args, callback) {
		// delete existing sorter
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
			
			self.logDebug(6, "Deleting sorter: " + params.id, params);
			
			self.storage.listFindDelete( 'global/sorters', { id: params.id }, function(err, sorter) {
				if (err) {
					return self.doError('sorter', "Failed to delete sorter: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted sorter: " + sorter.id, sorter);
				self.logTransaction('sorter_delete', sorter.id, self.getClientInfo(args, { sorter: sorter }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/sorters', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache sorters: " + err);
						return;
					}
					self.sorters = items;
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
	api_multi_update_sorter(args, callback) {
		// update multiple sorters in one call, i.e. sort_order
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
			
			self.logDebug(9, "Performing multi-sorter update", params);
			
			// convert item array to hash for quick matches in loop
			var update_map = {};
			for (var idx = 0, len = params.items.length; idx < len; idx++) {
				var item = params.items[idx];
				if (item.id) update_map[ item.id ] = item;
			}
			
			self.storage.listEachPageUpdate( 'global/sorters',
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
					
					self.logDebug(6, "Successfully updated multiple sorters");
					self.logTransaction('sorter_multi_update', '', self.getClientInfo(args, { 
						updated: Tools.hashKeysToArray( Tools.copyHashRemoveKeys(params.items[0], { id:1 }) ) 
					}));
					
					callback({ code: 0 });
					
					// update cache in background
					self.storage.listGet( 'global/sorters', 0, 0, function(err, items) {
						if (err) {
							// this should never fail, as it should already be cached
							self.logError('storage', "Failed to cache sorters: " + err);
							return;
						}
						self.sorters = items;
					});
				}
			); // listEachPageUpdate
		}); // loadSession
	}
	
} );
