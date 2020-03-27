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
				mid: '',
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
			message.mid = self.generateMessageID(message.id);
			if (user.privileges.admin) message.admin = true;
			
			// callback({ code: 0, message: message });
			self.processNewTopic( message, user, callback );
			
			// send e-mail
			if (params.send_to_listserv) {
				var mail_text = '';
				mail_text += 'To: ' + self.config.get('listserv_address') + "\n";
				mail_text += 'From: ' + params.from + "\n";
				mail_text += 'Subject: ' + params.subject + "\n";
				mail_text += 'X-Mendo-Org: v' + self.server.__version + "\n";
				mail_text += 'Message-ID: ' + message.mid + "\n";
				mail_text += "\n";
				mail_text += params.body.trim() + "\n";
				
				self.logDebug(6, "Sending mail for new topic", { text: mail_text });
				
				self.usermgr.mail.send( mail_text, {}, function(err) {
					if (err) self.logError('email', "Failed to send e-mail: " + err);
					else self.logDebug(6, "Successfully sent e-mail");
				}); // mail.send
			} // send to listserv
			
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
				
				// Planer can throw, so we have to try/catch it
				var stripped = null;
				try {
					stripped = Planer.extractFrom(params.body, 'text/plain');
				}
				catch (err) {
					self.logError('mail', "Failed to strip reply text: " + err);
				}
				
				var message = {
					id: Tools.generateShortID('m'),
					mid: '',
					username: user.username,
					type: 'reply',
					from: params.from,
					subject: parent_record.subject,
					body: stripped || params.body,
					date: Tools.timeNow(true),
					parent: params.parent,
					replies: 0,
					locations: '',
					tags: '',
					headers: {}
				};
				message.mid = self.generateMessageID(message.id);
				if (user.privileges.admin) message.admin = true;
				
				callback({ code: 0, message: message });
				self.processReply( message, user, function() {} );
				
				// send e-mails
				if (params.send_to_listserv) {
					// listserv needs from address to match actual sender
					var mail_text = '';
					mail_text += 'To: ' + self.config.get('listserv_address') + "\n";
					mail_text += 'From: ' + params.from + "\n";
					mail_text += 'Subject: Re: ' + parent_record.subject + "\n";
					mail_text += 'X-Mendo-Org: v' + self.server.__version + "\n";
					mail_text += 'Message-ID: ' + message.mid + "\n";
					if (parent_record.mid) {
						mail_text += 'In-Reply-To: <' + parent_record.mid + ">\n";
						mail_text += 'References: <' + parent_record.mid + ">\n";
					}
					mail_text += "\n";
					mail_text += params.body.trim() + "\n";
					
					self.logDebug(6, "Sending listserv mail for reply", { text: mail_text });
					
					self.usermgr.mail.send( ''+mail_text, {}, function(err) {
						if (err) self.logError('email', "Failed to send e-mail: " + err);
						else self.logDebug(6, "Successfully sent e-mail");
					}); // mail.send
				} // send to listserv
				
				if (params.send_to_sender)  {
					// e-mail to sender can use reply-to
					// (better chance of avoiding spam filters this way)
					var mail_text = '';
					mail_text += 'To: ' + params.send_to_sender + "\n";
					mail_text += 'From: ' + self.config.get('bounce_reply') + "\n";
					mail_text += 'Reply-To: ' + params.from + "\n";
					mail_text += 'Subject: Re: ' + parent_record.subject + "\n";
					mail_text += 'X-Mendo-Org: v' + self.server.__version + "\n";
					mail_text += 'Message-ID: ' + message.mid + "\n";
					if (parent_record.mid) {
						mail_text += 'In-Reply-To: <' + parent_record.mid + ">\n";
						mail_text += 'References: <' + parent_record.mid + ">\n";
					}
					mail_text += "\n";
					mail_text += params.body.trim() + "\n";
					
					self.logDebug(6, "Sending direct mail for reply", { text: mail_text });
					
					self.usermgr.mail.send( ''+mail_text, {}, function(err) {
						if (err) self.logError('email', "Failed to send e-mail: " + err);
						else self.logDebug(6, "Successfully sent e-mail");
					}); // mail.send
				} // send to sender
				
				// log user activity for post
				self.logUserActivity( user.username, 'message_post', self.getClientInfo(args, { 
					message: { type: message.type, id: message.id, parent: message.parent, subject: message.subject }
				}));
				
				// track counts of transaction types in daily stats
				self.updateDailyStat( 'message_post', 1 );
			}); // unbase.get
		}); // loadSession
	}
	
	generateMessageID(id) {
		// hash ID for a longer Message-ID header
		return '<' + Tools.digestHex(id, 'md5') + '-' + id + '@mendo.org>';
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
				mid: '',
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
			
			// further subject cleanup (ugh, people really mangle these things)
			while (message.subject.match(/^(\w+\:\s*|\[.+\]\s*\-\s*)/)) {
				message.subject = message.subject.replace(/^(\w+\:\s*|\[.+\]\s*\-\s*)/, '');
			}
			while (message.subject.match(/^(\w+\:\s*|\[.+\]\s*)/)) {
				message.subject = message.subject.replace(/^(\w+\:\s*|\[.+\]\s*)/, '');
			}
			
			if (!message.subject.match(/\S/)) {
				message.subject = '(No subject)';
			}
			
			if (params.date) {
				// use date from e-mail if we can
				message.date = Tools.getDateArgs( params.date ).epoch || message.date;
			}
			
			// skip e-mails that came from us (dupe post prevention)
			if (message.headers['x-mendo-org']) {
				self.logDebug(5, "Skipping message ingest, as it was self-sent (x-mendo-org)", message);
				callback({ code: 0, skipped: true, reason: 'x-mendo-org' });
				return;
			}
			if (message.headers['message-id'] && message.headers['message-id'].match(/\@mendo\.org\>/)) {
				self.logDebug(5, "Skipping message ingest, as it was self-sent (message-id)", message);
				callback({ code: 0, skipped: true, reason: 'message-id' });
				return;
			}
			if (!message.headers['list-id'] && !message.headers.list) {
				self.logDebug(5, "Skipping message ingest, as it has no List-Id header", message);
				
				var all_recipients = params.to || '';
				if (params.cc) all_recipients += ', ' + params.cc;
				var special_match = new RegExp( self.config.get('special_fwd_match'), 'i' );
				
				if (self.config.get('special_fwd_address') && all_recipients.match(special_match)) {
					var mail_text = '';
					mail_text += 'To: ' + self.config.get('special_fwd_address') + "\n";
					mail_text += 'From: ' + self.config.get('email_from') + "\n";
					mail_text += 'Reply-To: ' + params.from + "\n";
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
				
				callback({ code: 0, skipped: true, reason: 'special' });
				return;
			} // no List-Id
			
			// Did someone reply to the entire ListServ digest?  If so, skip processing
			// (This would likely become a topic, and then the DB would have to index the entire digest)
			if (message.subject.match(/\bAnnounce\s+Digest\,\s+Vol\b/)) {
				self.logDebug(5, "Skipping message ingest, as it was a digest reply", message);
				callback({ code: 0, skipped: true, reason: 'digest-reply' });
				return;
			}
			
			// honor reply-to over from, if present
			if (message.headers['reply-to']) {
				message.from = message.headers['reply-to'];
			}
			
			// check email for bans
			var email_clean = self.extractEmailFromText(message.from);
			var now = Tools.timeNow(true);
			
			for (var idx = 0, len = self.bans.length; idx < len; idx++) {
				var ban = self.bans[idx];
				if ((!ban.expires || (ban.expires > now)) && email_clean.match(ban.email)) {
					message.ban = ban;
					self.logDebug(5, "Skipping message ingest, as the address is banned", message);
					callback({ code: 0, skipped: true, reason: 'user-banned' });
					return;
				}
			} // foreach ban
			
			// check from address against global opt-out hash
			self.loadUserFromEmail( message.from, function(user) {
				if (user && user.opt_out) {
					self.logDebug(5, "Skipping message ingest, as user has opted out: " + user.username, message);
					callback({ code: 0, skipped: true, reason: 'user-opt-out' });
					return;
				}
				if (user) {
					// message is from one of our users!
					message.username = user.username;
					if (user.privileges.admin) message.admin = true;
				}
				
				// see if this is a topic or reply by LRU or fuzzy-exact-matching subject
				self.lookupParentMessage( message, function(err, parent_id) {
					if (parent_id) {
						// reply
						message.type = 'reply';
						message.body = (params.stripped || params.text || '').replace(/\r\n/g, "\n").replace( self.body_strip, '' ).trim();
						message.parent = parent_id;
					}
					else {
						// new topic
						message.type = 'topic';
						message.body = (params.text || '').replace(/\r\n/g, "\n").replace( self.body_strip, '' ).trim();
					}
					
					// Some messages have no plain text, and only have HTML.
					// Detect this and downconvert.
					if (!message.body.match(/[a-zA-Z0-9]/) && params.html) {
						message.body = He.decode(params.html).replace(/<.+?>/g, '').trim();
						message.body = message.body.replace(/\r\n/g, "\n").replace( self.body_strip, '' ).trim();
					}
					
					// if we still have no message body, set it to the subject line
					// (some people send a message in the subject with no body)
					if (!message.body.match(/\S/)) message.body = message.subject;
					
					// we don't need to store all the headers in the DB, but save a few key ones
					message.to = message.headers.to || message.from;
					message.cc = message.headers.cc || '';
					message.mid = message.headers['message-id'] || self.generateMessageID(message.id);
					
					// MID needs to be unique
					if (self.mid_cache.has(message.mid)) {
						self.logDebug(5, "Skipping message ingest, as message is a duplicate", message);
						callback({ code: 0, skipped: true, reason: 'duplicate-message-id' });
						return;
					}
					
					var headers = message.headers;
					delete message.headers;

					if (parent_id) self.processReply(message, user, callback);
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
				}); // lookupParentMessage
			}); // hashGet (opt-out)
		}); // loadSession
	}
	
	lookupParentMessage(message, callback) {
		// try to find parent message, to see if this is a reply
		// first consult Message-ID LRU map, as it's fast and in RAM,
		// fallback to DB search for lookalike subject
		var self = this;
		
		if (message.headers.references) {
			// planer can deliver this as an array
			if (Tools.isaArray(message.headers.references)) {
				message.headers.references = message.headers.references.join(' ');
			}
			
			// cleanup
			var refs = message.headers.references.trim().split(/\s+/).map( function(ref) {
				return ref.replace(/\>\,\>$/, '>');
			} );
			var parent_id = '';
			
			for (var idx = 0, len = refs.length; idx < len; idx++) {
				var ref = refs[idx];
				parent_id = this.mid_cache.get(ref);
				if (parent_id) idx = len;
			} // foreach ref
			
			if (parent_id) {
				// got it, that was easy!
				this.logDebug(9, "Matched reply '" + message.id + "' to parent '" + parent_id + "' using LRU cache");
				return callback(null, parent_id);
			}
		}
		
		// welp, we gotta fuzzy-exact-match the subject now
		var subject_clean = Unidecode( message.subject ).replace(/\'/g, '').replace(/\W+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
		if (!subject_clean.match(/\w/)) return callback(null); // subject must have alphanum for this to work
		
		var threshold_sec = Tools.getSecondsFromText( this.config.get('subject_match_threshold') );
		var dargs = Tools.getDateArgs( Tools.normalizeTime( message.date, { hour:12, min:0, sec:0 } ) - threshold_sec );
		var search_query = '(date >= "' + dargs.yyyy_mm_dd + '" && subject =~ "' + subject_clean +'")';
		
		this.unbase.search( 'messages', search_query, { offset: 0, limit: 10, sort_dir: -1 }, function(err, results) {
			if (err) {
				self.logError('db', "Failed DB subject lookalike search: " + search_query + ": " + err);
				return callback();
			}
			self.logDebug(9, "Considering potential parents for lookalike match for " + message.id, {
				record_ids: results.records.map( function(record) { return record.id } ),
				search_query: search_query,
				subject_clean: subject_clean
			});
			
			// need to find a more exact subject match to really make this a reply
			// (the DB only does an exact "contains" match, but it can't ensure start and end of string)
			var parent_id = '';
			if (results.total) {
				for (var idx = 0, len = results.records.length; idx < len; idx++) {
					var test_subject = Unidecode( results.records[idx].subject ).replace(/\'/g, '').replace(/\W+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
					if (test_subject === subject_clean) {
						parent_id = results.records[idx].parent || results.records[idx].id;
						idx = len;
					}
				} // foreach record
			} // results.total
			
			if (parent_id) {
				self.logDebug(9, "Matched reply '" + message.id + "' to parent '" + parent_id + "' using DB subject lookalike");
				callback(null, parent_id);
			}
			else callback();
		}); // unbase.search
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
			
			// store mid --> parent mapping in LRU
			self.mid_cache.set( message.mid, message.parent );
			
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
		
		// don't allow dates beyond 6 months or so
		var max_epoch = message.date + (86400 * 180);
		
		// Try strict date parser first, fallback back to casual one if no matches
		var chrons = [];
		try { chrons = Chrono.strict.parse(temp, ref, { forwardDate: true }); }
		catch(err) { this.logError('chrono', "Failed to parse dates: " + err); }
		
		for (var idx = 0, len = chrons.length; idx < len; idx++) {
			var result = chrons[idx];
			var start_epoch = Tools.getDateArgs( result.start.date() ).epoch;
			var known = result.start.knownValues || {};
			
			if ((('day' in known) || ('weekday' in known)) && (start_epoch < max_epoch)) {
				epochs.push( start_epoch );
				if (result.end) {
					epochs.push( Tools.getDateArgs( result.end.date() ).epoch );
				}
				idx = len;
			} // sane date
		} // foreach chron
		
		if (!epochs.length) {
			// fallback to casual parser
			try { chrons = Chrono.casual.parse(temp, ref, { forwardDate: true }); }
			catch(err) { this.logError('chrono', "Failed to parse dates: " + err); }
			
			for (var idx = 0, len = chrons.length; idx < len; idx++) {
				var result = chrons[idx];
				var start_epoch = Tools.getDateArgs( result.start.date() ).epoch;
				var known = result.start.knownValues || {};
				
				if ((('day' in known) || ('weekday' in known)) && (start_epoch < max_epoch)) {
					epochs.push( start_epoch );
					if (result.end) {
						epochs.push( Tools.getDateArgs( result.end.date() ).epoch );
					}
					idx = len;
				} // sane date
			} // foreach chron
		} // casual parser
		
		// no dates should be before the ref date (midnight)
		var ref_epoch = Tools.normalizeTime( message.date, { hour:0, min:0, sec:0 } );
		
		if (epochs.length) {
			// found date or dates in text
			epochs.sort();
			var start_epoch = epochs.shift();
			if (start_epoch < ref_epoch) start_epoch = ref_epoch;
			dates.push( Tools.getDateArgs(start_epoch).yyyy_mm_dd );
			
			if (epochs.length) {
				// more than one date, we have a range
				var end_epoch = epochs.pop();
				if (end_epoch < ref_epoch) end_epoch = ref_epoch;
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
			
			var tag_map = Object.create(null);
			self.tags.forEach( function(tag) {
				tag_map[ tag.id ] = tag.id;
				tag_map[ tag.title.replace(/\W+/g, '').toLowerCase() ] = tag.id;
			});
			
			temp.replace(/\s\#(\w+)/g, function(m_all, tag) {
				tag = tag.toLowerCase();
				if (tag_map[tag]) hashtags.push( tag_map[tag] );
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
			
			// store mid --> id mapping in LRU
			self.mid_cache.set( message.mid, message.id );
			
			// scan for user triggers (search alerts)
			if (message.tags == "unsorted") {
				self.applyAutoSorters( message.id, function() {
					self.scanUserSearchTriggers(message.id);
				} );
			}
			else self.scanUserSearchTriggers(message.id);
		} ); // unbase.insert
	}
	
	applyAutoSorters(record_id, callback) {
		// match new topic against auto-sorters to find categories
		var self = this;
		var index_config = this.unbase.indexes.messages;
		var chosen_sorter = null;
		
		this.logDebug(9, "Applying auto-sort for record ID: " + record_id);
		
		this.sorters.sort( function(a, b) {
			return (a.sort_order < b.sort_order) ? -1 : 1;
		} );
		
		async.eachSeries( this.sorters,
			function(sorter, callback) {
				self.logDebug(9, "Testing sorter on record: " + record_id, sorter);
				
				self.storage.searchSingle( sorter.query, record_id, index_config, function(err, found) {
					if (err) {
						self.logError('sorter', "Failed to run index searchSingle: " + err, sorter );
					}
					if (found) {
						// record matches sorter query!
						chosen_sorter = sorter;
						callback("ABORT");
					}
					else {
						self.logDebug(9, "Sorter search did not match");
						setImmediate( function() { callback(); } );
					}
				}); // searchSingle
			},
			function() {
				var sorter = chosen_sorter;
				if (!sorter) return callback();
				
				self.logDebug(5, "Auto-Sort: Sorter matched record: " + record_id + ", applying categories", sorter);
				
				var updates = {
					tags: sorter.categories.join(', ')
				};
				
				// perform database update
				self.unbase.update( 'messages', record_id, updates, function(err) {
					if (err) return self.logError('message', "Failed to update message: " + record_id + ": " + err);
					else self.logDebug(9, "Categories applied successfully");
					
					callback();
				}); // unbase.update
			}
		); // eachSeries
	}
	
});
