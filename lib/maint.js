// Mendo.org Maintenance Layer
// Copyright (c) 2020 Joseph Huckaby

var assert = require("assert");
var fs = require("fs");
var os = require("os");
var cp = require("child_process");
var zlib = require('zlib');
var mkdirp = require('mkdirp');
var async = require('async');
var Path = require('path');

var Class = require('class-plus');
var Component = require("pixl-server/component");
var Tools = require("pixl-tools");
var Request = require("pixl-request");

var glob = Tools.glob;

module.exports = Class({
	
},
class Maintenance {
	
	setupMaint() {
		// setup stat tracking system
		this.stats = {
			currentMinute: {},
			lastMinute: {},
			currentDay: { 
				timeStart: Tools.timeNow(true),
				transactions: {} 
			},
			mem: {},
			cpu: {}
		};
	}
	
	updateDailyStat(key, delta = 1) {
		// update daily transaction stat, e.g. user_login
		this.stats.currentDay.transactions[key] = (this.stats.currentDay.transactions[key] || 0) + delta;
	}
	
	maintSecond() {
		// grab real-time stats from web server and accumulate in currentMinute
		var web_stats = this.web.getStats();
		var minute = this.stats.currentMinute;
		
		if (!web_stats.stats) web_stats.stats = {};
		if (!web_stats.stats.total) web_stats.stats.total = {};
		if (!web_stats.queue) web_stats.queue = {};
		
		minute.sockets = (minute.sockets || 0) + (web_stats.stats.num_sockets || 0);
		minute.requests = (minute.requests || 0) + (web_stats.stats.num_requests || 0);
		minute.bytes_in = (minute.bytes_in || 0) + (web_stats.stats.bytes_in || 0);
		minute.bytes_out = (minute.bytes_out || 0) + (web_stats.stats.bytes_out || 0);
		minute.avg_elapsed = (minute.avg_elapsed || 0) + (web_stats.stats.total.avg || 0);
		minute.running = (minute.running || 0) + (web_stats.queue.running || 0);
		minute.pending = (minute.pending || 0) + (web_stats.queue.pending || 0);
		minute.count = (minute.count || 0) + 1;
	}
	
	maintMinute() {
		// copy select values to daily
		var self = this;
		var minute = this.stats.currentMinute;
		var day = this.stats.currentDay;
		
		// day totals
		['requests', 'bytes_in', 'bytes_out'].forEach( function(key) {
			day[key] = (day[key] || 0) + (minute[key] || 0);
		} );
		
		// calc sec averages for performa
		for (var key in minute) {
			minute[key] = Math.floor( minute[key] / (minute.count || 1) );
		}
		
		// rollover minute stats into lastMinute, reset for next minute
		this.stats.lastMinute = minute;
		this.stats.currentMinute = {};
		
		// fetch memory settings for children (ML)
		var cmd = this.config.get('ps_monitor_cmd') || '/bin/ps -eo "ppid pid %cpu rss"';
		
		this.logDebug(10, "Checking server resources: " + cmd);
		
		var finish = function(err, stdout, stderr) {
			if (err) {
				self.logError('stats', "Failed to exec ps: " + err);
				return;
			}
			var lines = stdout.split(/\n/);
			var pids = {};
			
			// process each line from ps response
			for (var idx = 0, len = lines.length; idx < len; idx++) {
				var line = lines[idx];
				if (line.match(/(\d+)\s+(\d+)\s+([\d\.]+)\s+(\d+)/)) {
					var ppid = parseInt( RegExp.$1 );
					var pid = parseInt( RegExp.$2 );
					var cpu = parseFloat( RegExp.$3 );
					var mem = parseInt( RegExp.$4 ) * 1024; // k to bytes
					pids[ pid ] = { ppid: ppid, cpu: cpu, mem: mem };
				} // good line
			} // foreach line
			
			self.logDebug(10, "Raw process data:", pids);
			
			// grab stats for daemon pid
			if (pids[ process.pid ]) {
				var info = pids[ process.pid ];
				self.stats.mem.main = info.mem;
				self.stats.cpu.main = info.cpu;
			}
			
			// grab stats for ML pid (fasttext)
			if (self.ml.pid && pids[ self.ml.pid ]) {
				var info = pids[ self.ml.pid ];
				self.stats.mem.ml = info.mem;
				self.stats.cpu.ml = info.cpu;
			}
		}; // finish
		
		var child = null;
		try {
			child = cp.exec( cmd, { timeout: 5 * 1000 }, finish );
		}
		catch(err) {
			self.logError('stats', "Failed to exec ps: " + err);
		}
		if (child && child.pid && child.on) child.on('error', function (err) {
			self.logError('stats', "Failed to exec ps: " + err);
		});
	}
	
	maintReset() {
		// daily stat reset
		this.stats.currentDay = {
			timeStart: Tools.timeNow(true),
			transactions: {} 
		};
	}
	
	runMaintenance() {
		// run all daily maintenance bits
		async.series([
			this.runListMaintenance.bind(this),
			this.runDatabaseMaintenance.bind(this),
			this.calcDBSize.bind(this)
		]);
	}
	
	runListMaintenance(callback) {
		// run nightly storage maint, then proceed to DB maint
		var self = this;
		if (this.server.shut) return process.nextTick(callback);
		
		var max_rows = this.config.get('list_row_max') || 0;
		if (!max_rows) return process.nextTick( callback );
		
		var list_paths = ['logs/activity'];
		
		async.eachSeries( list_paths, 
			function(list_path, callback) {
				// iterator function, work on single list
				self.storage.listGetInfo( list_path, function(err, info) {
					// list may not exist, skip if so
					if (err) return callback();
					
					// check list length
					if (info.length > max_rows) {
						// list has grown too long, needs a trim
						self.logDebug(5, "Nightly maint: List " + list_path + " has grown too long, trimming to max: " + max_rows, info);
						self.storage.listSplice( list_path, max_rows, info.length - max_rows, null, callback );
					}
					else {
						// no trim needed, proceed to next list
						callback();
					}
				} ); // get list info
			}, // iterator
			function(err) {
				if (err) {
					self.logError('maint', "Failed to trim lists: " + err);
				}
				
				// done with maint
				self.logDebug(4, "List maintenance complete");
				callback();
			} // complete
		); // eachSeries
	}
	
	runDatabaseMaintenance(callback) {
		// run routine daily tasks, called after storage maint completes.
		var self = this;
		if (this.server.shut) return process.nextTick(callback);
		
		// search for very old messages, delete them
		var dargs = Tools.getDateArgs( Tools.timeNow(true) - Tools.getSecondsFromText( this.config.get('expiration') ) );
		var search_query = 'date:<' + dargs.yyyy_mm_dd;
		var index_config = this.unbase.indexes.messages;
		this.logDebug(5, "Nightly maint: Searching for expired messages: " + search_query);
		
		// use the low-level indexer API because we only need the record IDs
		this.storage.searchRecords( search_query, index_config, function(err, results) {
			if (err) {
				self.logError('maint', "Failed to search expired records: " + search_query + ": " + err);
				return callback();
			}
			if (!results || !Tools.numKeys(results)) {
				self.logDebug(5, "Nightly maint: No expired messages found");
				return callback();
			}
			
			// convert hash to array format required by bulkDelete
			var records = Object.keys(results);
			
			self.logDebug(5, "Bulk deleting " + records.length + " expired records", 
				(self.debugLevel(9) && (records.length < 1000)) ? records : '');
			
			self.unbase.bulkDelete( 'messages', records, function(err) {
				if (err) {
					self.logError('maint', "Failed to bulk delete records: " + err);
					return callback();
				}
				self.logDebug(5, "Database maintenance complete");
				callback();
			} ); // bulkDelete
		}); // searchRecords
	}
	
	calcDBSize(callback) {
		// measure DB size on disk (full scan)
		var self = this;
		if (this.server.shut) return process.nextTick(callback);
		
		var storage_config = this.config.get('Storage');
		if (storage_config.engine != 'Filesystem') {
			return process.nextTick(callback);
		}
		
		var engine_config = storage_config.Filesystem;
		var base_dir = engine_config.base_dir;
		var cmd = '/usr/bin/du -sk ' + base_dir + '/';
		var time_start = Tools.timeNow(true);
		
		this.logDebug(5, "Nightly maint: Calculating database size on disk: " + cmd);
		
		cp.exec( cmd, function(err, stdout, stderr) {
			if (err) {
				self.logError('maint', "Failed to calculate DB size: " + cmd + ": " + err);
				return callback();
			}
			if (stdout && stdout.match(/(\d+)/)) {
				var kBytes = parseInt( RegExp.$1 );
				self.stats.dbTotalBytes = kBytes * 1024;
				
				var elapsed = Tools.timeNow(true) - time_start;
				self.logDebug(5, "Nightly maint: Calculated DB size: " + Tools.getTextFromBytes(self.stats.dbTotalBytes), { elapsed } );
			}
			
			callback();
		}); // cp.exec
	}
	
	archiveLogs() {
		// archive all logs (called once daily at midnight)
		// log_archive_storage: { enabled, key_template, expiration }
		var self = this;
		var src_spec = this.config.get('log_dir') + '/*.log';
		
		if (this.config.get('log_archive_path')) {
			// archive to filesystem (not storage)
			var dest_path = this.config.get('log_archive_path');
			this.logDebug(4, "Archiving logs: " + src_spec + " to: " + dest_path);
			
			// generate time label from previous day, so just subtracting 30 minutes to be safe
			var epoch = Tools.timeNow(true) - 1800;
			
			this.logger.archive(src_spec, dest_path, epoch, function(err) {
				if (err) self.logError('maint', "Failed to archive logs: " + err);
				else self.logDebug(4, "Log archival complete");
			});
			
			return;
		}
		
		// archive to storage (i.e. S3, etc.)
		var arch_conf = this.config.get('log_archive_storage');
		if (!arch_conf || !arch_conf.enabled) return;
		
		var exp_date = 0;
		if (arch_conf.expiration) {
			exp_date = Tools.timeNow() + Tools.getSecondsFromText( arch_conf.expiration );
		}
		
		this.logDebug(4, "Archiving logs: " + src_spec + " to: " + arch_conf.key_template, arch_conf);
		
		// generate time label from previous day, so just subtracting 30 minutes to be safe
		var epoch = Tools.timeNow(true) - 1800;
		
		// fill date/time placeholders
		var dargs = Tools.getDateArgs( epoch );
		
		glob(src_spec, {}, function (err, files) {
			if (err) return callback(err);
			
			// got files
			if (files && files.length) {
				async.eachSeries( files, function(src_file, callback) {
					// foreach file
					
					// add filename to args
					dargs.filename = Path.basename(src_file).replace(/\.\w+$/, '');
					
					// construct final storage key
					var storage_key = Tools.sub( arch_conf.key_template, dargs );
					self.logDebug(5, "Archiving log: " + src_file + " to: " + storage_key);
					
					// rename local log first
					var src_temp_file = src_file + '.' + Tools.generateUniqueID(32) + '.tmp';
					
					fs.rename(src_file, src_temp_file, function(err) {
						if (err) {
							return callback( new Error("Failed to rename: " + src_file + " to: " + src_temp_file + ": " + err) );
						}
						
						if (storage_key.match(/\.gz$/i)) {
							// gzip the log archive
							var gzip = zlib.createGzip();
							var inp = fs.createReadStream( src_temp_file );
							inp.pipe(gzip);
							
							self.storage.putStream( storage_key, gzip, function(err) {
								// all done, delete temp file
								fs.unlink( src_temp_file, function(uerr) {
									if (uerr) self.logError('maint', "Failed to delete temp file: " + src_temp_file + ": " + uerr);
									if (err) return callback(err);
									if (exp_date) self.storage.expire( storage_key, exp_date );
									callback();
								} );
							}); // putStream
						} // gzip
						else {
							// straight copy (no compress)
							var inp = fs.createReadStream( src_temp_file );
							
							self.storage.putStream( storage_key, inp, function(err) {
								// all done, delete temp file
								fs.unlink( src_temp_file, function(ul_err) {
									if (ul_err) self.logError('maint', "Failed to delete temp file: " + src_temp_file + ": " + ul_err);
									if (err) return callback(err);
									if (exp_date) self.storage.expire( storage_key, exp_date );
									callback();
								} );
							}); // putStream
						} // copy
					} ); // fs.rename
				}, 
				function(err) {
					if (err) self.logError('maint', "Failed to archive logs: " + err);
					else self.logDebug(4, "Log archival complete");
				}); // eachSeries
			} // got files
			else {
				self.logDebug(9, "Log Archive: No log files found matching: " + src_spec);
			}
		} ); // glob
	}
	
});
