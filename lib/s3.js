// Mendo.org S3 Mail Ingest Component
// Copyright (c) 2020 Joseph Huckaby

var assert = require("assert");
var fs = require("fs");
var mkdirp = require('mkdirp');
var async = require('async');
var Path = require('path');

var Class = require('class-plus');
var Component = require("pixl-server/component");
var Tools = require("pixl-tools");

var AWS = require('aws-sdk');
var Planer = require('planer');
var SimpleParser = require('mailparser').simpleParser;

module.exports = Class({
	
	s3: null
	
},
class S3MailIngest extends Component {
	
	startup(callback) {
		var self = this;
		this.logDebug(3, "S3 Mail Ingest subsystem starting up");
		
		this.api = this.server.API;
		
		if (this.config.get('schedule')) {
			// schedule ingests
			this.setup();
			
			this.server.on( this.config.get('schedule'), function() {
				self.ingest();
			});
		}
		
		return callback();
	}
	
	setup() {
		// setup AWS / S3
		AWS.config.update( this.config.get('AWS') );
		this.s3 = new AWS.S3( this.config.get('S3') );
	}
	
	ingest() {
		// pull down raw mail from S3, parse it, and Mailgunify it
		var self = this;
		var params = {
			Prefix: this.config.get('key_prefix'),
			MaxKeys: 1000
		};
		this.logDebug(6, "Checking for new e-mail in S3", params);
		
		this.s3.listObjects(params, function(err, data) {
			if (err) {
				self.logError('s3', "Failed to listObjects: " + err);
				return;
			}
			if (!data || !data.Contents || !data.Contents.length) {
				self.logDebug(6, "No e-mail found in S3");
				return;
			}
			
			async.eachSeries( data.Contents, function(item, callback) {
				self.logDebug(6, "Working on S3 object: " + item.Key, item);
				var text = '';
				var json = null;
				
				async.series([
					function(callback) {
						self.s3.getObject( { Key: item.Key }, function(err, data) {
							if (err) {
								self.logError('s3', "Failed to fetch object: " + item.Key + ": " + err);
								return callback("SKIP");
							}
							text = data.Body.toString();
							callback();
						}); // s3.getObject
					},
					function(callback) {
						self.s3.deleteObject( { Key: item.Key }, function(err, data) {
							if (err) {
								self.logError('s3', "Failed to delete object: " + item.Key + ": " + err);
								return callback("SKIP");
							}
							callback();
						}); // s3.getObject
					},
					function(callback) {
						// parse raw mime text
						var opts = {
							skipHtmlToText: false,
							skipImageLinks: true,
							skipTextToHtml: true,
							skipTextLinks: true
						};
						
						SimpleParser(text, opts, function(err, parsed) {
							if (err) {
								self.logError('mail', "Failed to parse MIME: " + item.Key + ": " + err);
								return callback("SKIP");
							}
							
							if (!parsed.to) parsed.to = { text: '' };
							if (!parsed.from) parsed.from = { text: '' };
							
							// cleanup
							json = {
								format: 'mpv1',
								to: parsed.to.text,
								from: parsed.from.text,
								subject: parsed.subject,
								
								// JH 2020-20-22 Using S3 epoch timestamp, as mail sent date is often very wrong
								// date: parsed.date,
								date: item.LastModified,
								
								text: parsed.text,
								stripped: Planer.extractFrom(parsed.text, 'text/plain'),
								html: parsed.html,
								headers: mapToObj(parsed.headers)
							};
							for (var key in json.headers) {
								if (json.headers[key].text) json.headers[key] = json.headers[key].text;
							}
							
							// remove some verbose SES cruft
							delete json.headers["x-ses-receipt"];
							delete json.headers["x-ses-dkim-signature"];
							delete json.headers["dkim-signature"];
							delete json.headers["x-me-sender"];
							delete json.headers["x-me-proxy-cause"];
							delete json.headers["x-me-proxy"];
							
							callback();
						}); // SimpleParser
					}, // parse
					function(callback) {
						// save JSON to disk for backup
						var dargs = Tools.getDateArgs( json.date );
						var dir = self.config.get('base_dir') + '/' + dargs.yyyy_mm_dd;
						var file = dir + '/' + dargs.hh_mi_ss.replace(/\:/g, '-') + '-' + Tools.generateUniqueID(8) + '.json';
						
						Tools.mkdirp( dir, function(err) {
							if (err) {
								self.logError('mail', "Failed to create directory: " + dir + ": " + err);
								return callback("SKIP");
							}
							var payload = JSON.stringify(json, null, "\t") + "\n";
							
							self.logDebug(10, "Processed message", json);
							
							fs.writeFile( file, payload, function(err) {
								if (err) {
									self.logError('fs', "Failed to write file: " + file + ": " + err);
								}
								else {
									self.logDebug(9, "Saved to file: " + file);
								}
								callback();
							});
						} ); // mkdirp
					}, // save
					function(callback) {
						// invoke API to receive mail
						json.api_key = self.config.get('api_key');
						self.api.invoke( '/api/app/receive_mail', json, function(resp) {
							callback();
						});
					} // api
				], 
				function(err) { 
					// all done
					callback(); 
				}); // async.series
			}); // async.eachSeries
		}); // s3.listObjects
	}
	
	shutdown(callback) {
		this.logDebug(3, "S3 Mail Ingest subsystem shutting down");
		callback();
	}

}); // class

function mapToObj(map) {
	// shallow-convert ES6 map to standard object
	var obj = {};
	for (let [key, value] of map) {
		obj[key] = value;
	}
	return obj;
};

