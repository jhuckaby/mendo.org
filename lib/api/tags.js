// Mendo.org API Layer - Tags (a.k.a. Categories)
// Copyright (c) 2019 Joseph Huckaby
// Released under the MIT License

var fs = require('fs');
var assert = require("assert");
var async = require('async');
var Class = require('class-plus');
var Tools = require("pixl-tools");

module.exports = Class({
	
},
class Tags {
	
	api_get_tags(args, callback) {
		// get list of all tags
		var self = this;
		var params = args.params;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.storage.listGet( 'global/tags', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got tag list
		} ); // loaded session
	}
	
	api_get_tag(args, callback) {
		// get single tag for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.storage.listFind( 'global/tags', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('tag', "Failed to locate tag: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, tag: item });
			} ); // got tag
		} ); // loaded session
	}
	
	api_create_tag(args, callback) {
		// add new tag
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
			
			// id must be unique
			if (Tools.findObject(self.tags, { id: params.id })) {
				return self.doError('tag', "That Tag ID already exists: " + params.id, callback);
			}
			if (Tools.findObject(self.locations, { id: params.id })) {
				return self.doError('tag', "That Tag ID already exists as a Location ID: " + params.id, callback);
			}
			
			self.logDebug(6, "Creating new tag: " + params.title, params);
			
			self.storage.listPush( 'global/tags', params, function(err) {
				if (err) {
					return self.doError('tag', "Failed to create tag: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created tag: " + params.title, params);
				self.logTransaction('tag_create', params.title, self.getClientInfo(args, { tag: params }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/tags', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache tags: " + err);
						return;
					}
					self.tags = items;
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_tag(args, callback) {
		// update existing tag
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
			
			self.logDebug(6, "Updating tag: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/tags', { id: params.id }, params, function(err, tag) {
				if (err) {
					return self.doError('tag', "Failed to update tag: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated tag: " + tag.title, params);
				self.logTransaction('tag_update', tag.title, self.getClientInfo(args, { tag: tag }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/tags', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache tags: " + err);
						return;
					}
					self.tags = items;
				});
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_tag(args, callback) {
		// delete existing tag
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
			
			self.logDebug(6, "Deleting tag: " + params.id, params);
			
			self.storage.listFindDelete( 'global/tags', { id: params.id }, function(err, tag) {
				if (err) {
					return self.doError('tag', "Failed to delete tag: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted tag: " + tag.title, tag);
				self.logTransaction('tag_delete', tag.title, self.getClientInfo(args, { tag: tag }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/tags', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache tags: " + err);
						return;
					}
					self.tags = items;
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
	api_multi_update_tag(args, callback) {
		// update multiple tags in one call
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
			
			self.logDebug(9, "Performing multi-tag update", params);
			
			// convert item array to hash for quick matches in loop
			var update_map = {};
			for (var idx = 0, len = params.items.length; idx < len; idx++) {
				var item = params.items[idx];
				if (item.id) update_map[ item.id ] = item;
			}
			
			self.storage.listEachPageUpdate( 'global/tags',
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
					
					self.logDebug(6, "Successfully updated multiple tags");
					self.logTransaction('tag_multi_update', '', self.getClientInfo(args, { 
						updated: Tools.hashKeysToArray( Tools.copyHashRemoveKeys(params.items[0], { id:1 }) ) 
					}));
					
					callback({ code: 0 });
					
					// update cache in background
					self.storage.listGet( 'global/tags', 0, 0, function(err, items) {
						if (err) {
							// this should never fail, as it should already be cached
							self.logError('storage', "Failed to cache tags: " + err);
							return;
						}
						self.tags = items;
					});
				}
			); // listEachPageUpdate
		}); // loadSession
	}
	
} );
