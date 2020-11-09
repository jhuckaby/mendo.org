// Mendo.org API Layer - User
// Copyright (c) 2020 Joseph Huckaby
// Released under the MIT License

var fs = require('fs');
var assert = require("assert");
var async = require('async');
var UserAgent = require('useragent');
var Class = require('class-plus');
var Tools = require("pixl-tools");

module.exports = Class({
	
},
class User {
	
	api_get_user_activity(args, callback) {
		// get rows from user activity log (with pagination)
		var self = this;
		var params = args.params;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.storage.listGet( 'security/' + user.username, parseInt(params.offset || 0), parseInt(params.limit || 50), function(err, items, list) {
				if (err) {
					// no rows found, not an error for this API
					return callback({ code: 0, rows: [], list: { length: 0 } });
				}
				
				// parse user agents
				items.forEach( function(item) {
					if (!item.headers || !item.headers['user-agent']) return;
					var agent = UserAgent.parse( item.headers['user-agent'] );
					item.useragent = agent.toString(); // 'Chrome 15.0.874 / Mac OS X 10.8.1'
				});
				
				// success, return rows and list header
				callback({ code: 0, rows: items, list: list });
			} ); // got data
		} ); // loaded session
	}
	
	api_user_favorite(args, callback) {
		// fav or unfav a message record
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			id: /^\w+$/,
			fav: /^(true|false)$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var updates = {};
			if (params.fav) updates.favorites = "+" + user.username;
			else updates.favorites = "-" + user.username;
			
			var now = Tools.timeNow(true);
			updates.modified = now;
			
			self.unbase.update( 'messages', params.id, updates );
			
			if (params.fav) self.updateDailyStat( 'message_fav', 1 );
			
			callback({ code: 0 });
		} ); // loaded session
	}
	
	api_user_settings(args, callback) {
		// update user settings (non-critical only)
		var self = this;
		var params = args.params;
		
		delete params.password;
		delete params.new_password;
		delete params.old_password;
		delete params.salt;
		delete params.email;
		delete params.full_name;
		delete params.active;
		delete params.created;
		delete params.privileges;
		delete params.verified;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			for (var key in params) {
				user[key] = params[key];
			}
			
			var path = 'users/' + self.usermgr.normalizeUsername(user.username);
			user.modified = Tools.timeNow(true);
			
			self.logDebug(6, "Updating user", user);
			
			self.storage.put( path, user, function(err) {
				if (err) return self.doError('user', "Failed to save settings for: " + user.username + ": " + err, callback);
				
				callback({ 
					code: 0, 
					user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1 } )
				});
				
				// update search triggers for user
				self.updateUserSearchTriggers( user );
				
			}); // storage.put
		} ); // loaded session
	}
	
	api_check_user_exists(args, callback) {
		// checks if username is taken (used for showing green checkmark on form)
		var self = this;
		var query = args.query;
		var path = 'users/' + this.usermgr.normalizeUsername(query.username);
		
		// do not cache this API response
		this.forceNoCacheResponse(args);
		
		if (!query.username.match(this.usermgr.usernameMatch)) {
			// invalid username
			callback({ code: 0, user_invalid: true });
			return;
		}
		
		if (query.username.match(this.usermgr.usernameBlock)) {
			// if username is blocked, return as if it exists (username taken)
			callback({ code: 0, user_exists: true });
			return;
		}
		
		this.storage.get(path, function(err, user) {
			callback({ code: 0, user_exists: !!user });
		} );
	}
	
	api_verify_email(args, callback) {
		// verify e-mail address by checking user password salt string
		var self = this;
		var query = args.query;
		var path = 'users/' + this.usermgr.normalizeUsername(query.user);
		
		if (!this.requireParams(query, {
			user: this.usermgr.usernameMatch,
			auth: /^[A-Fa-f0-9]+$/
		}, callback)) return;
		
		// do not cache this API response
		this.forceNoCacheResponse(args);
		
		this.storage.get(path, function(err, user) {
			if (!user) {
				return self.doError('user', "User account not found: " + query.user, callback);
			}
			if (user.salt.substring(0, 32) != query.auth.substring(0, 32)) {
				// only comparing first 32 chars in case e-mail chopped off the verify URL
				return self.doError('user', "E-mail verification failed.", callback);
			}
			
			args.user = user;
			
			// set verified flag and save user
			user.verified = true;
			user.modified = Tools.timeNow(true);
			
			self.logDebug(6, "Updating user", user);
			
			self.storage.put( path, user, function(err) {
				if (err) return self.doError('user', "Failed to save user: " + query.user + ": " + err, callback);
				callback({ code: 0 });
			}); // storage.put
			
			// write verified email to global hash
			self.storage.hashPut( 'global/emails', user.email, query.user, function(err) {
				if (err) self.logError('storage', "Failed to update e-mail hash: " + err);
			});
			
			// log user activity
			self.logUserActivity(user.username, 'notice', self.getClientInfo(args, { 
				user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1, searches: 1, exclude_tags: 1, exclude_froms: 1 } ),
				description: "Verified e-mail address: " + user.email
			}));
		} ); // storage.get
	}
	
	api_send_email_verification(args, callback) {
		// re-send e-mail verification to user's registered address
		var self = this;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			args.session = session;
			args.user = user;
			
			args.self_url = self.web.getSelfURL(args.request, '/');
			self.usermgr.sendEmail( 'verify_email', args, function(err) {
				if (err) return self.doError('email', "Failed to send e-mail verification: " + err, callback);
				callback({ code: 0 });
			} ); // sendEmail
		}); // loadSession
	}
	
	api_lookup_user(args, callback) {
		// lookup user from e-mail address (must be verified)
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			email: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			self.loadUserFromEmail(params.email, function(user) {
				if (!user) return self.doError('user', "E-mail not found: " + params.email, callback);
				
				// success, return user record
				callback({
					code: 0,
					user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1 } )
				});
			}); // load user
		} ); // loaded session
	}
	
	api_logout_all(args, callback) {
		// logout all sessions associated with user (except current session)
		// do this in the background
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			password: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			if (!self.usermgr.comparePasswords(params.password, user.password, user.salt)) {
				return self.doError('login', "Your password is incorrect.", callback);
			}
			
			callback({ code: 0 });
			
			// begin background processing
			self.storage.enqueue( function(task, callback) {
				self.logoutAllUserSessions(session, user, callback);
			});
			
			// log user activity
			var activity_args = self.getClientInfo(args, { 
				user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1, searches: 1, exclude_tags: 1, exclude_froms: 1 } ),
				description: "Logged out all user sessions by request"
			});
			if (self.config.get('track_user_activity')) {
				self.logActivity('warning', activity_args);
			}
			self.logUserActivity(user.username, 'warning', activity_args);
			
		}); // loadSession
	}
	
	logoutAllUserSessions(session, user, callback) {
		// logout all sessions associated with user (except current session)
		var self = this;
		var username = user.username;
		var current_session_id = session.id;
		var report = '';
		
		this.logDebug(5, "Logging out all user sessions for: " + username, { exclude: current_session_id });
		
		this.storage.listEach( 'security/' + username, function(item, idx, callback) {
			// we only care about `user_login` actions
			if ((item.action != 'user_login') || !item.session_id) {
				return process.nextTick(callback);
			}
			if (item.session_id == current_session_id) {
				self.logDebug(9, "Skipping session delete, as it is the current one: " + item.session_id, { username } );
				return process.nextTick(callback);
			}
			
			var session_key = 'sessions/' + item.session_id;
			self.storage.get( session_key, function(err, data) {
				// error is non-fatal, as session may have expired or been previously deleted
				if (err || !data) {
					return process.nextTick(callback);
				}
				
				self.storage.delete( session_key, function(err) {
					// error is non-fatal, as session may have expired or been previously deleted
					if (err) return process.nextTick(callback);
					
					if (report) report += "\n\n";
					report += [
						"Session ID: " + item.session_id,
						"IP Address: " + data.ip,
						"User Agent: " + UserAgent.parse( data.useragent ).toString(),
						"Created: " + (new Date(data.created * 1000)).toString(),
						"Last Used: " + (new Date(data.modified * 1000)).toString()
					].join("\n");
					
					self.logDebug(6, "Deleted user session by request: " + item.session_id, data);
					callback();
				}); // storage.delete
			}); // storage.get
		}, 
		function() {
			// all done, send report if we actually deleted anything
			self.logDebug(6, "Completed logout sweep across security/" + username);
			
			if (report.length) {
				var args = {
					session: session, 
					user: user, 
					report: report,
					useragent: UserAgent.parse( session.useragent ).toString()
				};
				self.usermgr.sendEmail( 'logout_all_sessions', args, function(err) {
					if (err) self.logError('email', "Failed to send session report e-mail: " + err, session);
				} ); // sendEmail
			}
			else {
				self.logDebug(6, "No sessions deleted for " + username + ", so skipping report e-mail");
			}
			
			callback(); // queue
		} ); // listEach
	}
	
	api_send_email(args, callback) {
		// send arbitrary user-defined e-mail to any recipient
		// (special privilege required for this)
		// params: { to, subject, body }
		var self = this;
		var params = args.params;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'sendfree', callback)) return;
			
			var mail_text = '';
			mail_text += 'To: ' + params.to + "\n";
			mail_text += 'From: ' + self.config.get('email_from') + "\n";
			mail_text += 'Reply-To: ' + self.config.get('email_from')+ "\n";
			mail_text += 'Subject: (Mendo.org) ' + params.subject + "\n";
			mail_text += "\n";
			mail_text += "(This message was sent to you by Mendo.org)\n\n";
			mail_text += params.body + "\n";
			
			self.logDebug(6, "Sending custom e-mail", { text: mail_text });
			
			self.usermgr.mail.send( mail_text, {}, function(err) {
				if (err) self.logError('email', "Failed to send e-mail: " + err);
				else self.logDebug(6, "Successfully sent e-mail");
			}); // mail.send
			
			callback({ code: 0 });	
		} ); // loaded session
	}
	
});
