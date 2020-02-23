// Mendo.org API Layer - Submission & Email APIs
// Copyright (c) 2020 Joseph Huckaby
// Released under the MIT License

var fs = require('fs');
var assert = require('assert');
var async = require('async');
var Class = require('class-plus');
var Tools = require('pixl-tools');
var Planer = require('planer');
var Chrono = require('chrono-node');
var He = require('he');
var Unidecode = require('unidecode');

module.exports = Class({

},
class Submit {
	
	api_post_topic(args, callback) {
		// post new topic from UI
		// args: { subject, body, send_to_listserv }
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			body: /\S/,
			subject: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireVerifiedUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'post_topics', callback)) return;
			
			params.from = user.full_name + ' <' + user.email + '>';
			
			var message = {
				id: Tools.generateShortID('m'),
				username: user.username,
				type: 'topic',
				from: params.from,
				subject: params.subject,
				body: params.body,
				date: Tools.timeNow(true),
				parent: '',
				replies: 0,
				locations: '',
				tags: '',
				headers: {}
			};
			
			callback({ code: 0 });
			self.processNewTopic(message, user, function() {});
			
			// send e-mail
			var recipients = [];
			if (params.send_to_listserv) recipients.push( self.config.get('listserv_address') );
			
			if (recipients.length) {
				if (self.config.get('email_override')) recipients = [ self.config.get('email_override') ];
				
				var mail_text = '';
				mail_text += 'To: ' + recipients.join(', ') + "\n";
				mail_text += 'From: ' + params.from + "\n";
				mail_text += 'Subject: ' + params.subject + "\n";
				mail_text += 'X-Mendo-Org: v' + self.server.__version + "\n";
				mail_text += "\n";
				mail_text += params.body.trim() + "\n";
				
				self.logDebug(6, "Sending mail for new topic", { text: mail_text });
				
				self.usermgr.mail.send( mail_text, {}, function(err) {
					if (err) self.logError('email', "Failed to send e-mail: " + err);
					else self.logDebug(6, "Successfully sent e-mail");
				}); // mail.send
			} // recipients
			
			// log user activity for post
			self.logUserActivity( user.username, 'message_post', self.getClientInfo(args, { 
				message: { type: message.type, id: message.id, subject: message.subject }
			}));
			
			// track counts of transaction types in daily stats
			self.updateDailyStat( 'message_post', 1 );
		}); // loadSession
	}
	
	api_post_reply(args, callback) {
		// post reply from UI
		// args: { parent, body, send_to_listserv, send_to_sender }
		var self = this;
		var params = args.params;
		
		if (!this.requireParams(params, {
			parent: /^\w+$/,
			body: /\S/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireVerifiedUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'post_replies', callback)) return;
			
			params.from = user.full_name + ' <' + user.email + '>';
			
			self.unbase.get( 'messages', params.parent, function(err, parent_record) {
				if (err) return self.doError('post', "Parent message not found: " + err, callback);
				
				var message = {
					id: Tools.generateShortID('m'),
					username: user.username,
					type: 'reply',
					from: params.from,
					subject: parent_record.subject,
					body: Planer.extractFrom(params.body, 'text/plain'), // strip quoted original
					date: Tools.timeNow(true),
					parent: params.parent,
					replies: 0,
					locations: '',
					tags: '',
					headers: {}
				};
				
				callback({ code: 0, message: message });
				self.processReply( message, user, function() {} );
				
				// send e-mails
				var recipients = [];
				if (params.send_to_listserv) recipients.push( self.config.get('listserv_address') );
				if (params.send_to_sender) recipients.push( params.send_to_sender );
				
				if (recipients.length) {
					if (self.config.get('email_override')) recipients = [ self.config.get('email_override') ];
					
					var mail_text = '';
					mail_text += 'To: ' + recipients.join(', ') + "\n";
					mail_text += 'From: ' + params.from + "\n";
					mail_text += 'Subject: Re: ' + parent_record.subject + "\n";
					mail_text += 'X-Mendo-Org: v' + self.server.__version + "\n";
					mail_text += "\n";
					mail_text += params.body.trim() + "\n";
					
					self.logDebug(6, "Sending mail for reply", { text: mail_text });
					
					self.usermgr.mail.send( mail_text, {}, function(err) {
						if (err) self.logError('email', "Failed to send e-mail: " + err);
						else self.logDebug(6, "Successfully sent e-mail");
					}); // mail.send
				} // recipients
				
				// log user activity for post
				self.logUserActivity( user.username, 'message_post', self.getClientInfo(args, { 
					message: { type: message.type, id: message.id, parent: message.parent, subject: message.subject }
				}));
				
				// track counts of transaction types in daily stats
				self.updateDailyStat( 'message_post', 1 );
			}); // unbase.get
		}); // loadSession
	}
	
	processMailFormat_mailgun(params) {
		// process mail from Mailgun API
		params.headers = {};
		
		for (var key in params) {
			// Mailgun headers are title-case keys
			if (key.match(/^[A-Z]/)) {
				params.headers[ key.toLowerCase() ] = params[key];
				delete params[key];
			}
		}
		
		params.date = params.headers.date;
		params.text = params['body-plain'];
		params.stripped = params['stripped-text'];
		params.html = params['stripped-html'];
	}
	
	processMailFormat_mpv1(params) {
		// process mail from S3 / mailparser (v1)
		if (!params.headers) params.headers = {};
	}
	
	api_receive_mail(args, callback) {
		// receive post from mail system (e.g. Mailgun) 
		var self = this;
		var params = args.params;
		
		// Support multiple input formats (mailgun, mpv1)
		var func = 'processMailFormat_' + (params.format || 'mailgun');
		if (!this[func]) return this.doError('mail', "Unsupported message format: " + params.format, callback);
		this[func](params);
		
		if (!this.requireParams(params, {
			subject: /\S/,
			from: /\S/
		}, callback)) return;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireAdmin(session, user, callback)) return;
			
			// start composing message object
			var message = {
				id: Tools.generateShortID('m'),
				username: '',
				type: '',
				from: params.from,
				subject: params.subject.replace( self.subject_strip, '' ).trim(),
				body: '',
				date: Tools.timeNow(true),
				replies: 0,
				locations: '',
				tags: '',
				headers: params.headers
			};
			if (!message.subject.match(/\S/)) {
				message.subject = '(No subject)';
			}
			
			// further subject cleanup (ugh, people really mangle these things)
			while (message.subject.match(/^(\w+\:\s*|\[.+\]\-\s*)/)) {
				message.subject = message.subject.replace(/^(\w+\:\s*|\[.+\]\-\s*)/, '');
			}
			
			if (params.date) {
				// use date from e-mail if we can
				message.date = Tools.getDateArgs( params.date ).epoch || message.date;
			}
			
			// skip e-mails that came from us (dupe post prevention)
			if (message.headers['x-mendo-org']) {
				self.logDebug(5, "Skipping message ingest, as it was self-sent (x-mendo-org)", message);
				callback({ code: 0, skipped: true });
				return;
			}
			if (!message.headers['list-id'] && !message.headers.list) {
				self.logDebug(5, "Skipping message ingest, as it has no List-Id header", message);
				
				var all_recipients = params.to || '';
				if (params.cc) all_recipients += ', ' + params.cc;
				
				if (self.config.get('special_fwd_address') && all_recipients.match(self.config.get('special_fwd_match'))) {
					var mail_text = '';
					mail_text += 'To: ' + self.config.get('special_fwd_address') + "\n";
					mail_text += 'From: ' + params.from + "\n";
					mail_text += 'Subject: (Mendo.org) ' + params.subject + "\n";
					mail_text += "\n";
					mail_text += "(This message was forwarded to you by Mendo.org, as it has no List-Id header)\n\n";
					mail_text += params.text + "\n";
					
					self.logDebug(6, "Forwarding non-list mail to special recipient", { text: mail_text });
					
					self.usermgr.mail.send( mail_text, {}, function(err) {
						if (err) self.logError('email', "Failed to send e-mail: " + err);
						else self.logDebug(6, "Successfully sent e-mail");
					}); // mail.send
				} // special_fwd_address
				
				callback({ code: 0, skipped: true, special: true });
				return;
			} // no List-Id
			
			// Did someone reply to the entire ListServ digest?  If so, skip processing
			// (This would likely become a topic, and then the DB would have to index the entire digest)
			if (message.subject.match(/\bAnnounce\s+Digest\,\s+Vol\b/)) {
				self.logDebug(5, "Skipping message ingest, as it was a digest reply", message);
				callback({ code: 0, skipped: true });
				return;
			}
			
			// check email for bans
			var email_clean = self.extractEmailFromText(message.from);
			var now = Tools.timeNow(true);
			
			for (var idx = 0, len = self.bans.length; idx < len; idx++) {
				var ban = self.bans[idx];
				if ((!ban.expires || (ban.expires > now)) && email_clean.match(ban.email)) {
					message.ban = ban;
					self.logDebug(5, "Skipping message ingest, as the address is banned", message);
					callback({ code: 0, skipped: true });
					return;
				}
			} // foreach ban
			
			// check from address against global opt-out hash
			self.loadUserFromEmail( message.from, function(user) {
				if (user && user.opt_out) {
					self.logDebug(5, "Skipping message ingest, as user has opted out: " + user.username, message);
					callback({ code: 0, skipped: true });
					return;
				}
				if (user) {
					// message is from one of our users!
					message.username = user.username;
				}
				
				// see if this is a topic or reply by fuzzy-exact-matching subject
				var subject_clean = Unidecode( message.subject ).replace(/\"+/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
				var dargs = Tools.getDateArgs( Tools.normalizeTime( message.date, { hour:12, min:0, sec:0 } ) - (86400 * 14) );
				var search_query = '(type = "topic" && date >= "' + dargs.yyyy_mm_dd + '" && subject =~ "' + subject_clean +'")';
				
				self.unbase.search( 'messages', search_query, { offset: 0, limit: 10, sort_dir: -1 }, function(err, results) {
					if (err) return self.doError('db', "Failed DB search: " + err, callback);
					
					// need to find a more exact subject match to really make this a reply
					// (the DB only does an exact "contains" match, but it can't ensure start and end of string)
					var is_reply = false;
					var parent_record = null;
					if (results.total) {
						for (var idx = 0, len = results.records.length; idx < len; idx++) {
							var test_subject = Unidecode( results.records[idx].subject ).replace(/\"+/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
							if (test_subject == subject_clean) {
								is_reply = true;
								parent_record = results.records[idx];
								idx = len;
							}
						} // foreach record
					} // results.total
					
					if (is_reply) {
						// reply
						message.type = 'reply';
						message.body = (params.stripped || params.text || '(No message content)').replace(/\r\n/g, "\n").replace( self.body_strip, '' ).trim();
						message.parent = parent_record.id;
					}
					else {
						// new topic
						message.type = 'topic';
						message.body = (params.text || '(No message content)').replace(/\r\n/g, "\n").replace( self.body_strip, '' ).trim();
					}
					
					// Some messages have no plain text, and only have HTML.
					// Detect this and downconvert.
					if (!message.body.match(/[a-zA-Z0-9]/) && params.html) {
						message.body = He.decode(params.html).replace(/<.+?>/g, '').trim();
					}
					
					// we don't need to store all the headers in the DB, but save a few key ones
					message.to = message.headers.to || message.from;
					message.cc = message.headers.cc || '';
					var headers = message.headers;
					delete message.headers;
					
					if (is_reply) self.processReply(message, user, callback);
					else self.processNewTopic(message, user, callback);
					
					// save original headers into separate record in parallel
					self.storage.put( 'headers/' + message.id, headers, function(err) {
						if (err) self.logError('db', "Failed to write message headers: " + message.id + ": " + err);
					});
					
					if (user) {
						// log user activity for mail
						self.logUserActivity( user.username, 'message_post', { 
							message: { type: message.type, id: message.id, parent: message.parent, subject: message.subject, mail: true }
						});
					}
					
					// track counts of transaction types in daily stats
					self.updateDailyStat( 'message_post', 1 );
				}); // unbase.search
			}); // hashGet (opt-out)
		}); // loadSession
	}
	
	processReply(message, user, callback) {
		// insert reply into database
		var self = this;
		var now = Tools.timeNow(true);
		message.modified = now;
		
		this.logDebug(6, "Inserting reply to database", message);
		
		this.unbase.insert( 'messages', message.id, message, function(err) {
			// record is fully indexed
			if (err) return self.doError('db', "Failed DB insert: " + err, callback);
			callback({ code: 0, id: message.id });
			
			// update parent replies counter
			if (message.parent) {
				self.unbase.update( 'messages', message.parent, { replies: "+1", modified: now } );
			}
			
			// scan for user triggers (search alerts)
			self.scanUserSearchTriggers(message.id);
		} ); // unbase.insert
	}
	
	processNewTopic(message, user, callback) {
		// perform ML to find matching tags and locations
		var self = this;
		
		if (this.ml.config.get('mode') != 'active') {
			return this.finishNewTopic(message, user, callback);
		}
		
		this.ml.predict(message, function(err, tags) {
			if (err) {
				self.logError('ml', "Prediction failed: " + err);
			}
			else if (tags.length) {
				message.tags = tags.join(',');
			}
			self.finishNewTopic(message, user, callback);
		}); // ml.predict
	}
	
	finishNewTopic(message, user, callback) {
		// perform ML to find matching tags and locations
		var self = this;
		var temp = message.subject + "\n" + message.body;
		
		// Detect dates inside message subject and body
		var ref = new Date( message.date * 1000 );
		var epochs = [];
		var dates = [];
		
		try { 
			Chrono.parse(temp, ref, { forwardDate: true }).forEach( function(result) {
				epochs.push( Tools.getDateArgs( result.start.date() ).epoch );
				if (result.end) {
					epochs.push( Tools.getDateArgs( result.end.date() ).epoch );
				}
			});
		}
		catch(err) {
			this.logError('chrono', "Failed to parse dates: " + err);
		}
		
		// FUTURE NOTE: For now, restrict this to the first date range found in the body text.
		// Chrono tends to pick up very loose things as dates (e.g. "ages 6 years and over" --> 01-01-2026)
		epochs.splice(2);
		
		if (epochs.length) {
			// found date or dates in text
			epochs.sort();
			var start_epoch = epochs.shift();
			dates.push( Tools.getDateArgs(start_epoch).yyyy_mm_dd );
			
			if (epochs.length) {
				// more than one date, we have a range
				var end_epoch = epochs.pop();
				if (end_epoch < start_epoch + (86400 * 15)) { // max range
					var epoch = start_epoch + 43200; // 12 hours, making sure we don't hop a day due to DST
					
					while (epoch <= end_epoch) {
						var yyyy_mm_dd = Tools.getDateArgs(epoch).yyyy_mm_dd;
						if (yyyy_mm_dd != dates[dates.length - 1]) {
							dates.push( yyyy_mm_dd );
						}
						epoch += 43200; 
					} // while
				} // 2 week max
			} // multi-date
			
			message.when = dates.join(', ');
		} // found dates
		
		// scan subject and body for location names
		var loc_matches = temp.match( this.loc_match_all );
		var loc_tags = loc_matches ? loc_matches.map( function(loc) {
			return loc.replace(/\W+/g, '').toLowerCase();
		} ) : null;
		if (loc_tags) message.locations = [...new Set(loc_tags)].join(', ');
		
		// user may be allowed to #hashtag their way into categories
		if (user && user.privileges && (user.privileges.hashtags || user.privileges.admin) && !message.tags) {
			var hashtags = [];
			
			temp.replace(/\s\#(\w+)/g, function(m_all, tag) {
				tag = tag.toLowerCase();
				if (Tools.findObject(self.tags, { id: tag })) hashtags.push(tag);
				return '';
			});
			
			if (hashtags.length > 2) hashtags.splice(2);
			message.tags = hashtags.join(',');
		} // hashtags
		
		var now = Tools.timeNow(true);
		message.modified = now;
		
		// default to unsorted
		// (Side-note: Unbase "default_value" only kicks in if property is missing or null)
		if (!message.tags) message.tags = "unsorted";
		
		this.logDebug(6, "Inserting topic to database", message);
		
		this.unbase.insert( 'messages', message.id, message, function(err) {
			// record is fully indexed
			if (err) return self.doError('db', "Failed DB insert: " + err, callback);
			callback({ code: 0, id: message.id });
			
			// scan for user triggers (search alerts)
			self.scanUserSearchTriggers(message.id);
		} ); // unbase.insert
	}
	
});
