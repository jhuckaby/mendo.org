// Mendo.org API Layer - Bans
// Copyright (c) 2020 Joseph Huckaby
// Released under the MIT License

var fs = require('fs');
var assert = require("assert");
var async = require('async');
var Class = require('class-plus');
var Tools = require("pixl-tools");

module.exports = Class({
	
},
class Bans {
	
	api_get_bans(args, callback) {
		// get list of all bans
		var self = this;
		var params = args.params;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.storage.listGet( 'global/bans', 0, 0, function(err, items, list) {
				if (err) {
					// no items found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return items and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got ban list
		} ); // loaded session
	}
	
	api_get_ban(args, callback) {
		// get single ban for editing
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.storage.listFind( 'global/bans', { id: params.id }, function(err, item) {
				if (err || !item) {
					return self.doError('ban', "Failed to locate ban: " + params.id, callback);
				}
				
				// success, return item
				callback({ code: 0, ban: item });
			} ); // got ban
		} ); // loaded session
	}
	
	api_create_ban(args, callback) {
		// add new ban
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			email: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			args.session = session;
			
			params.id = Tools.generateShortID('b');
			params.username = user.username;
			params.created = params.modified = Tools.timeNow(true);
			
			// id must be unique
			if (Tools.findObject(self.bans, { id: params.id })) {
				return self.doError('ban', "That Ban ID already exists: " + params.id, callback);
			}
			
			self.logDebug(6, "Creating new ban: " + params.email, params);
			
			self.storage.listPush( 'global/bans', params, function(err) {
				if (err) {
					return self.doError('ban', "Failed to create ban: " + err, callback);
				}
				
				self.logDebug(6, "Successfully created ban: " + params.email, params);
				self.logTransaction('ban_create', params.email, self.getClientInfo(args, { ban: params }));
				
				callback({ code: 0, ban: params });
				
				// update cache in background
				self.storage.listGet( 'global/bans', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache bans: " + err);
						return;
					}
					self.bans = items;
				});
			} ); // listPush
		} ); // loadSession
	}
	
	api_update_ban(args, callback) {
		// update existing ban
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
			
			self.logDebug(6, "Updating ban: " + params.id, params);
			
			self.storage.listFindUpdate( 'global/bans', { id: params.id }, params, function(err, ban) {
				if (err) {
					return self.doError('ban', "Failed to update ban: " + err, callback);
				}
				
				self.logDebug(6, "Successfully updated ban: " + ban.email, params);
				self.logTransaction('ban_update', ban.email, self.getClientInfo(args, { ban: ban }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/bans', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache bans: " + err);
						return;
					}
					self.bans = items;
				});
			} ); // listFindUpdate
		} ); // loadSession
	}
	
	api_delete_ban(args, callback) {
		// delete existing ban
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
			
			self.logDebug(6, "Deleting ban: " + params.id, params);
			
			self.storage.listFindDelete( 'global/bans', { id: params.id }, function(err, ban) {
				if (err) {
					return self.doError('ban', "Failed to delete ban: " + err, callback);
				}
				
				self.logDebug(6, "Successfully deleted ban: " + ban.email, ban);
				self.logTransaction('ban_delete', ban.email, self.getClientInfo(args, { ban: ban }));
				
				callback({ code: 0 });
				
				// update cache in background
				self.storage.listGet( 'global/bans', 0, 0, function(err, items) {
					if (err) {
						// this should never fail, as it should already be cached
						self.logError('storage', "Failed to cache bans: " + err);
						return;
					}
					self.bans = items;
				});
			} ); // listFindDelete
		} ); // loadSession
	}
	
} );
