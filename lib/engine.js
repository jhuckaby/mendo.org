// Mendo.org Server Component
// Copyright (c) 2019 Joseph Huckaby

var assert = require("assert");
var fs = require("fs");
var os = require("os");
var zlib = require('zlib');
var mkdirp = require('mkdirp');
var async = require('async');
var Path = require('path');

var Class = require('class-plus');
var Component = require("pixl-server/component");
var Tools = require("pixl-tools");
var Request = require("pixl-request");
var LRU = require('pixl-cache');

var glob = Tools.glob;

module.exports = Class({
	__mixins: [ 
		require('./api.js'),
		require('./triggers.js'),
		require('./maint.js')
	],
},
class Mendo extends Component {
	
	startup(callback) {
		// start app service
		var self = this;
		this.logDebug(3, "Mendo.org engine starting up", process.argv );
		
		// use global config
		this.config = this.server.config;
		this.config.on('reload', this.prepConfig.bind(this));
		
		// we'll need these components frequently
		this.storage = this.server.Storage;
		this.unbase = this.server.Unbase;
		this.web = this.server.WebServer;
		this.api = this.server.API;
		this.usermgr = this.server.User;
		this.ml = this.server.ML;
		
		// initialize search triggers
		this.userSearchTriggers = {};
		
		// init maintenance (stats) system
		this.setupMaint();
		
		// init message-id LRU cache
		this.setupMessageLRUCache();
		
		// load bad words
		this.setupBadWordFilter();
		
		// special handler for home page, so we can customize TTL
		this.web.addURIHandler( /^\/$/, "Home", function(args, callback) {
			if (args.request.headers['user-agent'] && args.request.headers['user-agent'].match(/\b(MSIE|Trident)\b/)) {
				// legacy IE 6 thru 10 - unsupported
				args.internalFile = Path.resolve('htdocs/unsupported.html');
			}
			else {
				// All modern browsers - full support
				args.internalFile = Path.resolve('htdocs/index.html');
			}
			args.internalTTL = 'private, max-age=' + self.config.get('ttl');
			callback(false);
			
			// track hit counts for estimated "visitors" (rough estimate)
			self.updateDailyStat('visitors', 1);
		});
		
		// register our class as an API namespace
		this.api.addNamespace( "app", "api_", this );
		
		// shortcut for /api/app/file
		this.web.addURIHandler( /^\/files/, "File", this.api_file.bind(this) );
		
		// webserver stats
		this.web.addURIHandler( '/server-status', "Server Status", function(args, callback) {
			callback( self.web.getStats() );
		} );
		
		// misc redirects
		var redirects = this.config.get('redirects') || {};
		self.web.addURIHandler( /^\/(\w+)\/?$/, "Redirect", function(args, callback) {
			var key = args.matches[1];
			if (redirects[key]) {
				callback( "302 Found", { 
					Location: self.web.getSelfURL(args.request, redirects[key]) 
				}, null );
			}
			else {
				callback( "404 Not Found", {}, null );
			}
		});
		
		// listen for ticks and minutes for maint system
		this.server.on('tick', this.maintSecond.bind(this));
		this.server.on('minute', this.maintMinute.bind(this));
		
		// register hooks for when users are created / updated / deleted
		this.usermgr.registerHook( 'after_create', this.afterUserChange.bind(this, 'user_create') );
		this.usermgr.registerHook( 'after_update', this.afterUserChange.bind(this, 'user_update') );
		this.usermgr.registerHook( 'after_reset_password', this.afterUserChange.bind(this, 'user_password') );
		this.usermgr.registerHook( 'after_delete', this.afterUserChange.bind(this, 'user_delete') );
		this.usermgr.registerHook( 'after_login', this.afterUserLogin.bind(this) );
		
		this.usermgr.registerHook( 'before_create', this.beforeUserCreate.bind(this) );
		this.usermgr.registerHook( 'before_update', this.beforeUserUpdate.bind(this) );
		
		// intercept user login and session resume, to merge in extra data
		this.usermgr.registerHook( 'before_login', this.beforeUserLogin.bind(this) );
		this.usermgr.registerHook( 'before_resume_session', this.beforeUserLogin.bind(this) );
		
		// create a http request instance for various tasks
		this.request = new Request( "Mendo.org v" + this.server.__version );
		this.request.setTimeout( 30 * 1000 );
		this.request.setFollow( 5 );
		this.request.setAutoError( true );
		this.request.setKeepAlive( true );
		
		// archive logs daily at midnight
		this.server.on('day', function() {
			self.maintReset();
			self.archiveLogs();
		} );
		
		// enable storage maintenance
		this.server.on(this.config.get('maintenance'), function() {
			self.storage.runMaintenance( new Date(), self.runMaintenance.bind(self) );
		});
		
		async.series(
			[
				function(callback) {
					self.storage.listGet( 'global/tags', 0, 0, function(err, items) {
						if (err) return callback(err);
						self.tags = items;
						callback();
					});
				},
				function(callback) {
					self.storage.listGet( 'global/locations', 0, 0, function(err, items) {
						if (err) return callback(err);
						self.locations = items;
						callback();
					});
				},
				function(callback) {
					self.storage.listGet( 'global/bans', 0, 0, function(err, items) {
						if (err) return callback(err);
						self.bans = items;
						callback();
					});
				}
			],
			function(err) {
				if (err) return callback(err);
				
				// if we suffered a crash and pixl-server-storage had to run recovery, log a loud warning here
				if (self.storage.recovery_log) {
					self.logTransaction('warning', "Unclean Shutdown: Database performed recovery operations (" + self.storage.recovery_count + " transactions rolled back). See " + Path.resolve(self.storage.recovery_log) + " for full details." );
				}
				
				// pre-compile regexps and such
				self.prepConfig();
				
				// startup complete
				callback();
				
				// setup user triggers in the background
				self.setupUserSearchTriggers();
			}
		); // async.series
	}
	
	prepConfig() {
		// pre-compile regexps
		var email_prep = this.config.get('email_prep');
		this.subject_strip = new RegExp( email_prep.subject_strip );
		this.body_strip = new RegExp( email_prep.body_strip );
		
		// compile location list to regexp, using negative lookahead to omit street names (e.g. "Ukiah St")
		this.loc_match_all = new RegExp( "\\b(" + this.locations.map( function(loc) {
			return loc.title.toLowerCase().replace(/\s+/g, "\\s+");
		} ).join("|") + ")\\b(?!\\s+(st|street|ln|lane|rd|road|ave|avenue|hwy|highway|blvd|boulevard|dr|drive|way|ct|court|plz|plaza|ter|terrace|pl|place|pkwy|parkway|cir|circle)\\b)", "ig" );
	}
	
	setupBadWordFilter() {
		// load and prep bad word filter
		// called during startup, so it's okay to use fs sync APIs here
		var words = fs.readFileSync('conf/bad_words.txt', 'utf8').trim().split(/\n/).map( function(word) {
			return Tools.escapeRegExp( word.trim().toLowerCase() );
		});
		this.badWordMatchStr = "\\b(" + words.join('|') + ")s?\\b";
	}
	
	setupMessageLRUCache() {
		// setup LRU for message-id headers (for matching replies)
		// load from disk if saved from last shutdown
		var self = this;
		var mid_file = Path.join( this.config.get('log_dir'), 'mid-cache.json' );
		
		this.mid_cache = new LRU({ 
			maxItems: this.config.get('message_id_cache_size') || 1000 
		});
		
		// called during startup, so it's okay to use fs sync APIs here
		if (fs.existsSync(mid_file)) {
			// reload from disk
			var items = JSON.parse( fs.readFileSync(mid_file, 'utf8') );
			items.reverse();
			items.forEach( function(item) {
				self.mid_cache.set( item.key, item.value );
			});
		}
	}
	
	beforeUserLogin(args, callback) {
		// infuse data into user login client response
		var self = this;
		
		args.resp = {
			epoch: Tools.timeNow(),
			badWordMatchStr: this.badWordMatchStr
		};
		
		callback();
	}
	
	afterUserLogin(args) {
		// user has logged in
		var username = args.user.username;
		var user_stub = {};
		
		['username', 'full_name', 'email', 'active', 'created', 'modified', 'verified', 'opt_out'].forEach( function(key) {
			user_stub[key] = args.user[key];
		});
		
		var activity_args = this.getClientInfo(args, { 
			user: user_stub
		});
		activity_args.session_id = args.session.id;
		
		if (this.config.get('track_user_activity')) {
			this.logActivity('user_login', activity_args);
		}
		this.logUserActivity(username, 'user_login', activity_args);
	}
	
	beforeUserCreate(args, callback) {
		// hook user create (before changes are committed)
		var self = this;
		var user = args.user;
		
		Tools.mergeHashInto( user, this.config.get('default_user') );
		
		user.searches = [
			{ "name": "My Posts", "query": "from:" + user.username + " type:topic" },
			{ "name": "My Replies", "query": "from:" + user.username + " type:reply" }
		];
		
		// e-mail hash actions (deferred until verify)
		args.write_email_hash = false;
		args.delete_email_hash = false;
		
		// exception: admin create with pre-verify
		if (args.admin_user && user.verified) {
			args.write_email_hash = user.email;
		}
		
		callback();
	}
	
	beforeUserUpdate(args, callback) {
		// hook user update (before changes are committed)
		// (this ONLY fires when updating an existing user, not for new, nor delete)
		var self = this;
		var user = args.user;
		var updates = args.params;
		
		// do not allow user to self-update these params
		if (!args.admin_user) {
			delete updates.verified;
			delete updates.salt;
		}
		
		// check for changed password (adds log entry)
		if (updates.new_password) {
			args.do_password = true;
		}
		
		// if e-mail address has changed, trigger verification again
		if (updates.email != user.email) {
			user.verified = false;
			user.salt = Tools.generateUniqueID( 64, user.username );
			user.password = this.usermgr.generatePasswordHash( updates.old_password, user.salt );
			args.do_verify = true;
			
			// update e-mail hash
			args.delete_email_hash = user.email; // delete old
			args.write_email_hash = false; // deferred until re-verify
		}
		
		callback();
	}
	
	afterUserChange(action, args) {
		// user has changed (or created, or deleted)
		var self = this;
		var username = args.user.username; // username cannot change
		
		// add to activity log in the background
		var activity_args = this.getClientInfo(args, { 
			user: Tools.copyHashRemoveKeys( args.user, { password: 1, salt: 1, searches: 1, exclude_tags: 1, exclude_froms: 1 } )
		});
		if (this.config.get('track_user_activity')) {
			this.logActivity(action, activity_args);
		}
		if (!args.admin_user && (action != 'user_delete')) {
			// don't track admin user updates (this would expose admin's IP to user)
			this.logUserActivity(username, action, activity_args);
		}
		if (!args.admin_user && args.do_password && (action != 'user_password')) {
			// don't track admin user updates (this would expose admin's IP to user)
			this.logUserActivity(username, 'user_password', activity_args);
		}
		
		if (args.do_verify) {
			// send verification e-mail
			args.self_url = this.web.getSelfURL(args.request, '/');
			this.usermgr.sendEmail( 'verify_email', args );
		}
		
		// if deleting user, also delete e-mail hash entry
		if (action == 'user_delete') {
			args.delete_email_hash = args.user.email;
		}
		
		// maintain email hash
		if (args.delete_email_hash) {
			this.storage.hashDelete( 'global/emails', args.delete_email_hash, function(err) {
				if (err) self.logError('storage', "Failed to update e-mail hash: " + err);
			});
		}
		if (args.write_email_hash) {
			this.storage.hashPut( 'global/emails', args.write_email_hash, username, function(err) {
				if (err) self.logError('storage', "Failed to update e-mail hash: " + err);
			});
		}
		
		// delete user security log on account delete
		if (action == 'user_delete') {
			this.storage.enqueue( function(task, callback) {
				self.storage.listDelete( 'security/' + username, true, callback );
			});
		}
	}
	
	extractEmailFromText(text) {
		// FUTURE: Use this maybe: https://www.npmjs.com/package/email-addresses
		var email_clean = text.toLowerCase().trim();
		if (email_clean.match(/([a-zA-Z0-9\+\.\_\-]+\@[a-zA-Z0-9\.\-]+\.[a-zA-Z0-9\-]{2,})/)) {
			email_clean = RegExp.$1;
		}
		return email_clean;
	}
	
	loadUserFromEmail(email, callback) {
		// resolve e-mail to username, then load user data
		var self = this;
		var email_clean = this.extractEmailFromText(email);
		
		this.storage.hashGet( 'global/emails', email_clean, function(err, username) {
			if (err || !username) return callback(false);
			
			self.storage.get( 'users/' + username, function(err, user) {
				if (err || !user) return callback(false);
				
				callback(user);
			}); // storage.get
		}); // storage.hashGet
	}
	
	logUserActivity(username, action, orig_data) {
		// add event to user activity logs async
		var self = this;
		
		assert( Tools.isaHash(orig_data), "Must pass a data object to logUserActivity" );
		var data = Tools.copyHash( orig_data, true );
		
		data.action = action;
		data.epoch = Tools.timeNow(true);
		
		this.storage.enqueue( function(task, callback) {
			self.storage.listUnshift( 'security/' + username, data, { page_size: 100 }, callback );
		});
	}
	
	logActivity(action, orig_data) {
		// add event to activity logs async
		var self = this;
		
		assert( Tools.isaHash(orig_data), "Must pass a data object to logActivity" );
		var data = Tools.copyHash( orig_data, true );
		
		data.action = action;
		data.epoch = Tools.timeNow(true);
		
		this.storage.enqueue( function(task, callback) {
			self.storage.listUnshift( 'logs/activity', data, callback );
		});
		
		// optional web hook for system actions
		var sys_hooks = this.config.get('web_hooks');
		if (sys_hooks && sys_hooks[action]) {
			var web_hook_url = sys_hooks[action];
			if (typeof(web_hook_url) != 'string') web_hook_url = this.config.get('default_web_hook_url');
			if (!web_hook_url) return;
			
			var hook_args = Tools.copyHash(data);
			if (!hook_args.text && hook_args.description) {
				hook_args.text = hook_args.description;
			}
			delete hook_args.description;
			hook_args.text = this.config.getPath('client/name') + ": " + hook_args.text;
			this.logDebug(9, "Firing web hook for " + action + ": " + web_hook_url);
			this.request.json( web_hook_url, hook_args, function(err, resp, data) {
				// log response
				if (err) self.logDebug(9, "Web Hook Error: " + web_hook_url + ": " + err);
				else self.logDebug(9, "Web Hook Response: " + web_hook_url + ": HTTP " + resp.statusCode + " " + resp.statusMessage);
			} );
		}
		
		// track counts of transaction types in daily stats
		this.updateDailyStat( action, 1 );
	}
	
	logTransaction(code, msg, data) {
		// proxy request to system logger with correct component for dedi trans log
		this.logger.set( 'component', 'Transaction' );
		this.logger.transaction( code, msg, data );
		
		if (!data) data = {};
		if (!data.description) data.description = msg;
		this.logActivity(code, data);
	}
	
	logServerActivity(server_id, action, msg, orig_data) {
		// add event to server-specific activity log async
		var self = this;
		if (!orig_data) orig_data = {};
		
		assert( Tools.isaHash(orig_data), "Must pass a data object to logActivity" );
		var data = Tools.copyHash( orig_data, true );
		
		data.action = action;
		data.epoch = Tools.timeNow(true);
		data.description = msg;
		
		this.storage.enqueue( function(task, callback) {
			self.storage.listUnshift( 'logs/servers/' + server_id + '/activity', data, callback );
		});
	}
	
	saveMessageLRUCache() {
		// save contents of message-id LRU to disk
		var self = this;
		var mid_file = Path.join( this.config.get('log_dir'), 'mid-cache.json' );
		var items = [];
		var item = this.mid_cache.first;
		
		while (item) {
			items.push({ key: item.key, value: item.value });
			item = item.next;
		}
		
		// this happens during shutdown only, so it's okay to use the fs sync API
		fs.writeFileSync( mid_file, JSON.stringify(items) + "\n" );
	}
	
	shutdown(callback) {
		// shutdown sequence
		var self = this;
		this.shut = true;
		this.logDebug(2, "Shutting down Mendo.org");
		this.saveMessageLRUCache();
		callback();
	}
	
});
