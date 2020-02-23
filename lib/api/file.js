// Mendo.org API Layer - File upload (attachments) and viewing
// Copyright (c) 2020 Joseph Huckaby
// Released under the MIT License

var fs = require('fs');
var assert = require("assert");
var Path = require('path');
var os = require('os');
var async = require('async');
var mime = require('mime');

var Class = require('class-plus');
var Tools = require("pixl-tools");

module.exports = Class({
	
},
class FileManagement {
	
	api_upload_files(args, callback) {
		// upload file for user
		var self = this;
		var files = Tools.hashValuesToArray(args.files || {});
		var urls = [];
		// var dargs = Tools.getDateArgs( Tools.timeNow() );
		var exp_epoch = Tools.timeNow(true) + Tools.getSecondsFromText( this.config.get('expiration') );
		
		if (!files.length) {
			return this.doError('file', "No file upload data found in request.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var storage_key_prefix = 'files/' + user.username + '/' + Tools.generateShortID(); // + '/' + dargs.yyyy_mm_dd;
			
			async.eachSeries( files,
				function(file, callback) {
					// process single file upload
					var temp_file = file.path;
					var filename = Path.basename(file.name).replace(/[^\w\-\.]+/g, '_');
					var storage_key = storage_key_prefix + '/' + filename;
					var url = self.server.config.get('base_app_url') + '/' + storage_key;
					
					self.storage.putStream( storage_key, fs.createReadStream(temp_file), function(err) {
						if (err) return callback(err);
						urls.push( url );
						
						// set expiration date for file (fires off background task)
						self.storage.expire( storage_key, exp_epoch );
						
						callback();
					} ); // putStream
				},
				function(err) {
					if (err) return self.doError('file', "Failed to process uploaded file: " + err, callback);
					callback({ code: 0, urls: urls });
				}
			); // async.eachSeries
		} ); // loaded session
	}
	
	api_file(args, callback) {
		// view file for specified user on URI: /files/2018/04/15/myimage.jpg
		var self = this;
		var storage_key = '';
		
		if (args.query.path) {
			storage_key = 'files/' + args.query.path;
		}
		else if (args.request.url.replace(/\?.*$/).match(/files?\/(.+)$/)) {
			storage_key = 'files/' + RegExp.$1;
		}
		else {
			return callback( "400 Bad Request", {}, null );
		}
		
		// if we're using the filesystem, internal redirect to node-static
		// as it handles HTTP 206 partial and byte ranges (i.e. video "streaming")
		if (this.storage.engine.getFilePath) {
			this.storage.head( storage_key, function(err, info) {
				if (err) {
					if (err.code == "NoSuchKey") return callback( false ); // this allows fallback to local filesystem!
					else return callback( "500 Internal Server Error", {}, '' + err );
				}
				
				// internal redirect to static file
				args.internalFile = Path.resolve( self.storage.engine.getFilePath( self.storage.normalizeKey(storage_key) ) );
				self.logDebug(6, "Internal redirect for static response: " + storage_key + ": " + args.internalFile );
				return callback(false);
			} ); // head
			return;
		}
		
		this.storage.getStream( storage_key, function(err, stream) {
			if (err) {
				if (err.code == "NoSuchKey") return callback( false ); // this allows fallback to local filesystem!
				else return callback( "500 Internal Server Error", {}, '' + err );
			}
			
			callback( 
				"200 OK", 
				{
					"Content-Type": mime.getType( Path.basename(storage_key) ),
					"Cache-Control": "public, max-age=" + self.web.config.get('http_static_ttl')
				}, 
				stream 
			);
		} ); // getStream
	}
	
	api_get_download_token(args, callback) {
		// generate time-based download token (good for ~2 minutes, give or take)
		var self = this;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			if (!self.requirePrivilege(user, 'mbox', callback)) return;
			
			var time_div = Math.floor( Tools.timeNow(true) / 60 );
			var token = Tools.digestHex( self.config.get('secret_key') + user.username + time_div );
			
			callback({ code: 0, token: token });	
		} ); // loaded session
	}
	
	api_download_mbox(args, callback) {
		// perform search and stream results into Mbox file download
		var self = this;
		var params = Tools.copyHash(args.query);
		
		if (!this.requireParams(params, {
			token: /^\w+$/,
			username: /\S/,
			query: /\S/,
			filename: /^\S+$/
		}, callback)) return;
		
		// first, validate time-based download token
		var time_div = Math.floor( Tools.timeNow(true) / 60 );
		var token = Tools.digestHex( this.config.get('secret_key') + params.username + time_div );
		if (params.token != token) {
			// allow for 60 seconds of slop, just in case we crossed the minute boundary between token and download
			// (FUTURE: theoretically an NTP adjustment could kill this thing entirely)
			time_div--;
			token = Tools.digestHex( this.config.get('secret_key') + params.username + time_div );
			if (params.token != token) return this.doError('download', "The download URL is invalid or has expired.", callback);
		}
		
		// run DB search
		var search_query = params.query;
		var index_config = this.unbase.indexes.messages;
		this.logDebug(5, "Searching messages for download: " + search_query, params);
		
		// use the low-level indexer API because we only need the record IDs
		this.storage.searchRecords( search_query, index_config, function(err, results) {
			if (err) {
				return self.doError('download', "Failed to search records: " + search_query + ": " + err, callback);
			}
			if (!results) results = {};
			
			// convert hash to array for async iteration
			// sort by newest to oldest (by ID)
			var records = Object.keys(results).sort( function(a, b) { 
				return a.toString().localeCompare(b) * -1; 
			} );
			
			// if we're downloading a thread, optionally prepend the parent record
			if (params.parent) records.unshift( params.parent );
			
			if (!records.length) {
				return self.doError('download', "No messages found for download: " + search_query, callback);
			}
			
			self.logDebug(5, "Serializing " + records.length + " records into Mbox format", 
				(self.debugLevel(9) && (records.length < 100)) ? records : '');
			
			args.response.setHeader( 'Content-Type', 'application/mbox' );
			args.response.setHeader( 'Content-Disposition', 'attachment; filename="' + params.filename + '"' );
			args.response.writeHead( "200", "OK" );
			
			args.response.on('error', function(err) {
				if (callback) { 
					self.logError('download', "Download response error: " + err, params);
					callback(true); 
					callback = null; 
				}
			});
			args.response.on('close', function() {
				if (callback) { 
					self.logError('download', "Download connection terminated", params);
					callback(true); 
					callback = null; 
				}
			});
			args.response.on('finish', function() {
				if (callback) { 
					self.logError('download', "Download finished", params);
					callback(true); 
					callback = null; 
				}
			});
			
			async.eachSeries( records,
				function(record_id, callback) {
					// load one record and format it as an Mbox chunk
					self.unbase.get( 'messages', record_id, function(err, record) {
						if (err) {
							self.logError('download', "Failed to load message for download: " + record_id, params);
							return callback();
						}
						self.logDebug(9, "Composing chunk for record ID: " + record_id);
						
						var chunk = '';
						var email_clean = self.extractEmailFromText(record.from);
						var date_fmt = Tools.formatDate( record.date, '[ddd] [mmm] [dd] [hh]:[mi]:[ss] [yyyy]' );
						chunk += 'From ' + email_clean + ' ' + date_fmt + "\n";
						
						// now we need Date: Sun, 25 Dec 2011 21:33:37 +0800
						var gmt_offset = (new Date( record.date * 1000 )).toString().match(/\bGMT([\-\+]\d+)/)[1];
						date_fmt = Tools.formatDate( record.date, '[ddd], [dd] [mmm] [yyyy] [hh]:[mi]:[ss]' ) + ' ' + gmt_offset;
						
						// compose chunk and write it
						chunk += 'Date: ' + date_fmt + "\n";
						chunk += 'From: ' + record.from + "\n";
						chunk += 'To: ' + (record.to || record.from) + "\n";
						if (record.cc) chunk += 'Cc: ' + record.cc + "\n";
						chunk += 'Subject: ' + record.subject + "\n";
						chunk += 'MIME-Version: 1.0' + "\n";
						chunk += 'Content-Type: text/plain; charset=utf-8' + "\n";
						chunk += 'Content-Disposition: inline' + "\n";
						chunk += 'Content-Transfer-Encoding: 8bit' + "\n\n";
						chunk += record.body.trim() + "\n\n";
						
						args.response.write( chunk, 'utf8', callback );
					}); // unbase.get
				},
				function(err) {
					if (err) self.logError('download', "Download failed: " + err, params);
					args.response.end();
					if (callback) { callback(true); callback = null; }
					self.logDebug(6, "Mbox download complete");
				}
			); // eachSeries
		}); // searchRecords
	}
	
} );
