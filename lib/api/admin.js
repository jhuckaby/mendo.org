// Mendo.org API Layer - Admin
// Copyright (c) 2020 Joseph Huckaby
// Released under the MIT License

var fs = require('fs');
var assert = require("assert");
var async = require('async');
var Class = require('class-plus');
var Tools = require("pixl-tools");
var Planer = require('planer');

module.exports = Class({
	
},
class Admin {
	
	api_get_activity(args, callback) {
		// get rows from activity log (with pagination)
		var self = this;
		var params = args.params;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.storage.listGet( 'logs/activity', parseInt(params.offset || 0), parseInt(params.limit || 50), function(err, items, list) {
				if (err) {
					// no rows found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// success, return rows and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got data
		} ); // loaded session
	}
	
	api_update_message(args, callback) {
		// re-tag or otherwise update a message record
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		var now = Tools.timeNow(true);
		params.modified = now;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			
			// first get existing message, so we can check for changes
			self.unbase.get( 'messages', params.id, function(err, old) {
				if (err) return self.doError('message', "Failed to update message: " + params.id + ": " + err, callback);
				
				// sanity check
				// if ((old.type == 'topic') && (params.type == 'reply') && old.replies) {
				// 	return self.doError('message', "Cannot change topic type, as it has replies attached.", callback);
				// }
				
				// re-planer if changing type to reply
				if ((old.type == 'topic') && (params.type == 'reply') && params.parent) {
					try {
						params.body = Planer.extractFrom(old.body, 'text/plain'); // strip quoted original
					}
					catch (err) {
						self.logError('mail', "Failed to strip: " + params.id + ": " + err);
						params.body = old.body;
					}
					
					// did planer kill the whole thing?  Then just use the original
					if (!params.body.match(/\S/)) params.body = old.body;
				}
				
				// perform database update
				self.unbase.update( 'messages', params.id, params, function(err) {
					if (err) return self.doError('message', "Failed to update message: " + params.id + ": " + err, callback);
					callback({ code: 0 });
					
					if ((old.type == 'topic') && (params.type == 'reply') && params.parent) {
						// record is changing from a topic into a reply
						// increment new parent reply counter
						self.unbase.update( 'messages', params.parent, { replies: "+1", modified: now } );
						
						// update MID to point to new parent
						self.mid_cache.set( old.mid, params.parent );
						
						// move replies as well
						if (old.replies) self.transferMessageReplies( old.id, params.parent );
					}
					else if ((old.type == 'reply') && (params.type == 'topic') && old.parent) {
						// record is changing from a reply into a topic
						// decrement old parent reply counter
						self.unbase.update( 'messages', old.parent, { replies: "-1", modified: now } );
						
						// store mid --> id mapping in LRU
						if (old.mid) self.mid_cache.set( old.mid, old.id );
					}
					
					self.logTransaction('message_update', params.id, self.getClientInfo(args, { 
						params: params, 
						message: {
							id: old.id,
							type: old.type,
							replies: old.replies,
							parent: old.parent,
							subject: old.subject,
							from: old.from
						} 
					}));
					
					// scan for user triggers (search alerts)
					self.scanUserSearchTriggers(params.id);
					
				} ); // unbase.update
			}); // unbase.get
		} ); // loaded session
	}
	
	transferMessageReplies(old_parent, new_parent) {
		// move message replies to new parent
		var self = this;
		var search_query = 'parent:' + old_parent;
		var now = Tools.timeNow(true);
		var num_updated = 0;
		
		this.logDebug(5, "Searching replies for parent transfer: " + search_query);
		
		this.unbase.search( 'messages', search_query, { offset: 0, limit: 1000 }, function(err, results) {
			if (err) {
				self.logError('db', "Failed to search for replies: " + search_query + ": " + err);
				return;
			}
			
			var records = results.records.map( function(record) { return record.id; } );
			if (!records.length) {
				self.logDebug(9, "No replies found matching: " + search_query);
				return;
			}
			
			self.logDebug(6, "Updating " + records.length + " replies for parent transfer", {
				old_parent: old_parent,
				new_parent: new_parent,
				records: records
			});
			
			async.eachSeries( records, 
				function(id, callback) {
					self.unbase.update( 'messages', id, { parent: new_parent, modified: now }, function(err) {
						if (err) {
							self.logError('db', "Failed to update message: " + id + ": " + err);
						}
						else num_updated++;
						callback();
					}); // unbase.update
				},
				function() {
					// all done
					// FUTURE: This doesn't handle partial success very well
					if (!num_updated) return;
					
					// now update reply counter on new parent
					self.unbase.update( 'messages', new_parent, {
						replies: "+" + num_updated, 
						modified: now 
					} );
					
					// and update MID LRU cache for all transfers
					results.records.forEach( function(record) {
						self.mid_cache.set( record.mid, new_parent );
					});
				} // done
			); // eachSeries
		}); // searchRecords
	}
	
	api_delete_message(args, callback) {
		// permanently delete a message record
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.user = user;
			
			// first get existing message
			self.unbase.get( 'messages', params.id, function(err, old) {
				if (err) return self.doError('message', "Failed to update message: " + params.id + ": " + err, callback);
				
				self.unbase.delete( 'messages', params.id, function(err) {
					if (err) return self.doError('message', "Failed to delete message: " + params.id + ": " + err, callback);
					callback({ code: 0 });
					
					self.logTransaction('message_delete', params.id, self.getClientInfo(args, { 
						params: params, 
						message: {
							id: old.id,
							subject: old.subject,
							from: old.from
						} 
					}));
					
					if ((old.type == 'reply') && old.parent) {
						// decrement parent reply counter
						self.unbase.update( 'messages', old.parent, { replies: "-1", modified: Tools.timeNow(true) } );
					}
				} ); // unbase.delete
			} ); // unbase.get
		} ); // loaded session
	}
	
	api_ml_suggest(args, callback) {
		// suggest tags using ML
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.unbase.get( 'messages', params.id, function(err, record) {
				if (err) return self.doError('ml', "Message not found: " + err, callback);
				
				self.ml.predict(record, function(err, tags) {
					if (err) return self.doError('ml', "Prediction failed: " + err, callback);
					
					callback({ code: 0, tags: tags });
				});
			}); // unbase.get
		} ); // loaded session
	}
	
	api_bulk(args, callback) {
		// bulk update or delete messages
		// { query, action, updates }
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			action: /^(update|delete|reindex)$/
		}, callback)) return;
		
		if (params.action.match(/^(update|delete)$/) && !params.query) {
			return this.doError('bulk', "Cannot perform requested action without query", callback);
		}
		
		if ((params.action == 'update') && (!params.updates || !Tools.numKeys(params.updates))) {
			return this.doError('bulk', "Cannot update records without updates", callback);
		}
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			args.session = session;
			args.user = user;
			
			// special: reindex requires no search
			if (params.action == 'reindex') {
				var job_id = self.unbase.reindex( 'messages', params.fields );
				callback({ code: 0, job_id: job_id });
				
				self.logActivity('notice', self.getClientInfo(args, { 
					description: "Performed bulk database reindex operation"
				}));
				return;
			}
			
			// run DB search
			var search_query = params.query;
			var index_config = self.unbase.indexes.messages;
			self.logDebug(5, "Searching messages for bulk " + params.action + ": " + search_query, params);
			
			// use the low-level indexer API because we only need the record IDs
			self.storage.searchRecords( search_query, index_config, function(err, results) {
				if (err) {
					return self.doError('bulk', "Failed to search records: " + search_query + ": " + err, callback);
				}
				if (!results) results = {};
				
				// convert hash to array for bulk operation (no sort)
				var records = Object.keys(results);
				if (!records.length) {
					return self.doError('bulk', "No records matched your search query: " + search_query, callback);
				}
				
				self.logDebug(5, "Performing bulk " + params.action + " on " + records.length + " records", 
					(self.debugLevel(9) && (records.length <= 100)) ? records : '');
				
				// bulk operations will run in background
				// return job ID for tracking status
				var job_id = '';
				
				if (params.action == 'update') {
					params.updates.modified = Tools.timeNow(true);
					job_id = self.unbase.bulkUpdate( 'messages', records, params.updates );
				}
				else {
					job_id = self.unbase.bulkDelete( 'messages', records );
				}
				
				callback({ code: 0, job_id: job_id });
				
				self.logActivity('notice', self.getClientInfo(args, { 
					description: "Performed bulk DB " + params.action + " on " + records.length + " records"
				}));
			}); // searchRecords
		}); // loadSession
	}
	
	api_admin_stats(args, callback) {
		// generate more expensive admin stats for UI status page
		var self = this;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			var stats = {
				day: Tools.copyHash( self.stats.currentDay ),
				db: {
					bytes: self.stats.dbTotalBytes || 0
				},
				mem: self.stats.mem,
				cpu: self.stats.cpu,
				unbase: self.unbase.getStats(),
				cache: {},
				ml: {
					engine: self.ml.engine,
					version: self.ml.version
				}
			};
			
			stats.day.timeElapsed = Tools.timeNow(true) - stats.day.timeStart;
			
			if (self.storage.engine.cache) {
				stats.cache = self.storage.engine.cache.getStats();
			}
			
			// count active user search triggers
			// self.userSearchTriggers[username].searches.length
			stats.db.searchTriggers = 0;
			for (var username in self.userSearchTriggers) {
				var trigger = self.userSearchTriggers[username];
				if (trigger.searches) stats.db.searchTriggers += trigger.searches.length;
			}
			
			async.series([
				function(callback) {
					// ML training file size
					fs.stat( self.ml.train_file, function(err, info) {
						stats.ml.train = info ? info.size : 0;
						callback();
					});
				},
				function(callback) {
					// ML model file size
					fs.stat( self.ml.model_file, function(err, info) {
						stats.ml.model = info ? info.size : 0;
						callback();
					});
				},
				function(callback) {
					// total records in DB
					self.storage.hashGetInfo( 'unbase/index/messages/_id', function(err, hash) {
						stats.db.records = hash ? hash.length : 0;
						callback();
					});
				},
				function(callback) {
					// total topics / replies
					self.storage.get( 'unbase/index/messages/type/summary', function(err, data) {
						if (!data) data = {};
						if (!data.values) data.values = {};
						stats.db.topics = data.values.topic || 0;
						stats.db.replies = data.values.reply || 0;
						callback();
					});
				},
				function(callback) {
					// total users
					self.storage.listGetInfo( 'global/users', function(err, list) {
						stats.db.users = list ? list.length : 0;
						callback();
					});
				}
			],
			function() {
				// all done!
				callback({ code: 0, stats: stats });
			}); // async.series
			
		}); // loadSession
	}
	
});
