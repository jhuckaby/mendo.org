// Mendo.org Search Triggers Layer
// Copyright (c) 2020 Joseph Huckaby

var fs = require('fs');
var assert = require("assert");
var async = require('async');

var Class = require('class-plus');
var Tools = require("pixl-tools");
var PixlRequest = require("pixl-request");

module.exports = Class({
	
},
class Triggers {
	
	setupUserSearchTriggers() {
		// setup triggers on startup
		// (this is done in the background, as we may have thousands of users)
		var self = this;
		var total = 0;
		this.logDebug(5, "Setting up user search triggers");
		
		this.storage.listEach( 'global/users', function(item, idx, callback) {
			// do something with item, then fire callback
			var username = item.username;
			
			self.storage.get( 'users/' + username, function(err, user) {
				if (err) {
					self.logError('triggers', "User could not be loaded: " + username + ": " + err);
					return callback();
				}
				
				var alerts = (user.searches || []).filter( function(search) {
					return !!search.alerts;
				});
				
				if (alerts.length) {
					self.userSearchTriggers[ username ] = {
						recent: [], 
						searches: alerts,
						exclude_tags: user.exclude_tags || [],
						exclude_froms: user.exclude_froms || []
					};
					total += alerts.length;
				}
				callback();
			});
		}, 
		function() {
			// all users iterated over
			self.logDebug(5, '' + total + " user search triggers added");
		} );
	}
	
	scanUserSearchTriggers(record_id) {
		// scan all user search triggers for a created or (admin) updated record
		var self = this;
		var index_config = this.unbase.indexes.messages;
		
		this.logDebug(9, "Scanning all user search triggers for record ID: " + record_id);
		
		async.eachOfSeries( this.userSearchTriggers, function(trigger, username, callback) {
			// skip entire user if record is already in their recent list
			if (trigger.recent.includes(record_id)) {
				self.logDebug(9, "User " + username + " was recently alerted for record ID " + record_id + " (skipping triggers)");
				setImmediate( function() { callback(); } );
				return;
			}
			
			async.eachSeries( trigger.searches, function(search, callback) {
				// test one user trigger
				if (trigger.recent.includes(record_id)) {
					self.logDebug(9, "User " + username + " was recently alerted for record ID " + record_id + " (skipping triggers)");
					setImmediate( function() { callback(); } );
					return;
				}
				
				var query = search.query.toLowerCase().trim();
				if (search.categories) query += ' tags:' + search.categories.split(/\,\s*/).join('|');
				if (search.locations) query += ' locations:' + search.locations.split(/\,\s*/).join('|');
				
				if (trigger.exclude_tags.length) {
					query += ' tags:' + trigger.exclude_tags.map( function(tag) { return '-' + tag; } ).join(' ');
				}
				if (trigger.exclude_froms.length) {
					query += ' from:' + trigger.exclude_froms.map( function(from) { return '-"' + from + '"'; } ).join(' ');
				}
				
				if (!query.match(/\S/)) {
					// query is empty (could be date-only)
					setImmediate( function() { callback(); } );
					return;
				}
				
				self.logDebug(9, "Testing user trigger on record", { query, record_id, username, search });
				
				self.storage.searchSingle( query, record_id, index_config, function(err, found) {
					if (err) {
						self.logError('trigger', "Failed to run index searchSingle: " + err, { query, record_id, username, search } );
					}
					if (found) {
						// record matches user trigger, fire off e-mail
						self.fireUserSearchTrigger({ username, trigger, search, query, record_id }, callback);
					}
					else {
						self.logDebug(9, "Trigger search did not match");
						setImmediate( function() { callback(); } );
					}
				}); // searchSingle
				
			}, callback ); // eachSeries
		}); // eachOfSeries
	}
	
	fireUserSearchTrigger(args, callback) {
		// fire off a single user search trigger (e-mail)
		var self = this;
		var user = null;
		var record = null;
		var { username, trigger, search, query, record_id } = args;
		
		this.logDebug(6, "User search trigger matched record, sending alert notification", args);
		
		// increment trigger.recent count
		trigger.recent.push( record_id );
		if (trigger.recent.length > 10) trigger.recent.shift();
		
		async.series([
			function(callback) {
				// load user
				self.loadUser( username, function(err, data) {
					if (err) {
						self.logError('trigger', "User not found: " + username + " (skipping trigger fire)", args);
						return callback("SKIP");
					}
					user = data;
					callback();
				}); // loadUser
			},
			function(callback) {
				// load record
				self.unbase.get( 'messages', record_id, function(err, data) {
					if (err) {
						self.logError('trigger', "Record not found: " + record_id + " (skipping trigger fire)", args);
						return callback("SKIP");
					}
					record = data;
					callback();
				}); // unbase.get
			},
			function(callback) {
				// send e-mail
				var to = user.full_name + ' <' + user.email + '>';
				var from = record.from;
				var subject = '(Mendo.org) ' + record.subject;
				
				var message = '';
				message += "To: " + to + "\n";
				message += "From: " + from + "\n";
				message += "Subject: " + subject + "\n\n";
				message += '(This message was forwarded to you by Mendo.org, because it matched your search alert "' + search.name + '".)' + "\n\n";
				message += record.body + "\n";
				
				self.usermgr.mail.send( message, function(err, data) {
					if (err) self.logError('trigger', "Failed to send mail to: " + to + ": " + err, { args, data });
					else self.logDebug(6, "Email sent successfully", { args, data });
					callback();
				} ); // mail.send
				
				self.updateDailyStat( 'user_search_trigger', 1 );
			}
		], function() { callback(); }); // async.series
	}
	
	updateUserSearchTriggers(user) {
		// add/update/remove user's search triggers
		// take care to not overwrite the trigger cache
		var username = user.username;
		
		var alerts = (user.searches || []).filter( function(search) {
			return !!search.alerts;
		});
		
		if (alerts.length) {
			if (this.userSearchTriggers[username]) {
				// replace only the searches, not the recent (cache)
				this.userSearchTriggers[username].searches = alerts;
				this.userSearchTriggers[username].exclude_tags = user.exclude_tags || [];
				this.userSearchTriggers[username].exclude_froms = user.exclude_froms || [];
			}
			else {
				// newly added
				this.userSearchTriggers[ username ] = { 
					recent: [], 
					searches: alerts,
					exclude_tags: user.exclude_tags || [],
					exclude_froms: user.exclude_froms || []
				};
			}
		}
		else {
			// user has none
			delete this.userSearchTriggers[ username ];
		}
	}
	
});
