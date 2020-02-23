// Mendo.org Machine Learning Component
// Copyright (c) 2020 Joseph Huckaby

var assert = require("assert");
var fs = require("fs");
var mkdirp = require('mkdirp');
var async = require('async');
var Path = require('path');

var Class = require('class-plus');
var Component = require("pixl-server/component");
var Tools = require("pixl-tools");
var FastText = require("fasttext.js");
var Perf = require("pixl-perf");

var noop = function() {};

module.exports = Class({
	
	ft: null
	
},
class ML extends Component {
	
	startup(callback) {
		var self = this;
		this.logDebug(3, "ML subsystem starting up");
		
		// make sure our component's training/model dir is here
		try { mkdirp.sync( this.config.get('dir') ); }
		catch (err) {
			return callback( new Error("ML directory could not be created: " + this.config.get('dir') + ": " + err) );
		}
		
		this.unbase = this.server.Unbase;
		this.train_file = Path.join( this.config.get('dir'), 'train.txt' );
		this.model_file = Path.join( this.config.get('dir'), 'model.bin' );
		this.engine = "fastText";
		this.version = require('fasttext.js/package.json').version;
		
		if (!this.config.get('enabled')) {
			this.logDebug(3, "System disabled, skipping load");
			return callback();
		}
		
		if (this.config.get('schedule')) {
			// retrain nightly
			this.server.on( this.config.get('schedule'), function() {
				self.train( noop );
			});
		}
		
		if (fs.existsSync(this.model_file)) {
			// preload model into RAM
			this.load(callback);
		}
		else {
			this.logDebug(3, "No model found, skipping load");
			return callback();
		}
	}
	
	load(callback) {
		// load fasttext and model
		var self = this;
		this.unload();
		this.logDebug(6, "Loading model: " + this.model_file);
		
		this.ft = new FastText({
			loadModel: this.model_file
		});
		
		this.ft.load().then( function() {
			self.pid = self.ft.child.pid;
			self.logDebug(6, "Model load complete", { pid: self.pid });
			process.nextTick( callback );
		})
		.catch( function(err) {
			self.logError('ml', "Model load error: " + err, err.stack);
			return callback(err); 
		});
	}
	
	unload() {
		// unload model if in memory
		if (this.ft) {
			this.logDebug(6, "Unloading model");
			this.ft.unload();
			delete this.ft;
			delete this.pid;
		}
	}
	
	train(callback) {
		// scan EVERY topic in DB that have tags (and NOT unsorted) and train a model
		var self = this;
		
		async.series(
			[
				this.generateTrainingFile.bind(this),
				this.generateModelFile.bind(this)
			],
			function(err) {
				if (err) {
					self.logError('ml', "Training failed: " + err);
				}
				self.logDebug(6, "Training complete");
				self.load( callback );
			}
		); // series
	}
	
	getTrainingText(record) {
		// generate training text from record
		return [record.from, record.subject, record.body].join(' ').replace(/\s+/g, ' ');
	}
	
	generateTrainingFile(callback) {
		// generate training file
		var self = this;
		var done = false;
		
		var squery = "type:topic tags:-unsorted";
		var opts = {
			offset: 0,
			limit: 100
		};
		
		try { if (fs.existsSync(this.train_file)) fs.unlinkSync(this.train_file); }
		catch(err) {
			return callback(err);
		}
		this.logDebug(6, "Generating training file: " + this.train_file);
		
		async.whilst(
			function() { return !done; },
			function(callback) {
				// perform paginated db search
				self.unbase.search( 'messages', squery, opts, function(err, results) {
					if (err) return callback(err);
					
					// iterate over results
					async.eachSeries( results.records,
						function(record, callback) {
							// serialize record and log to training file
							if (!record.tags) return process.nextTick(callback); // sanity
							if (record.tags.match(/\bunsorted\b/)) return process.nextTick(callback); // sanity
							
							// labels
							var labels = record.tags.split(/\W+/).map( function(tag) {
								return '__label__' + tag;
							} );
							
							// compose line in the proper fasttext format, and append
							var line = labels.join(' ') + ' ' + self.getTrainingText(record);
							fs.appendFile( self.train_file, line + "\n", callback );
						},
						function(err) {
							// chunk complete, advance pagination or done
							if (err) return callback(err);
							
							if (results.records.length < opts.limit) done = true;
							else opts.offset += opts.limit;
							callback();
						}
					); // eachSeries
				} ); // search
			},
			function(err) {
				if (err) return callback(err);
				self.logDebug(6, "Training file completed: " + self.train_file);
				callback();
			}
		); // whilst
	}
	
	generateModelFile(callback) {
		// invoke fasttext to convert training data into model
		var self = this;
		
		this.logDebug(6, "Beginning training: " + this.train_file + " --> " + this.model_file, 
			this.config.get('train_options') );
		
		var fastText = new FastText({
			serializeTo: this.model_file.replace(/\.\w+$/, ''),
			trainFile: this.train_file,
			train: this.config.get('train_options') || {},
			
			trainCallback: function(res) {
				var pct = Tools.clamp( parseInt(res.progress), 0, 100 );
				self.logDebug(9, "Training progress: " + pct + "%", res);
			}
		});
		
		fastText.train().then( function(results) {
			self.logDebug(6, "Model generation complete", results);
			process.nextTick( callback );
		})
		.catch( function(err) {
			return callback(err);
		});
	}
	
	predict(record, callback) {
		// predict tags based on input text
		var self = this;
		if (!this.ft) return callback(false, []);
		
		var text = this.getTrainingText(record);
		this.logDebug(9, "Predicting labels for: " + text);
		
		var perf = new Perf();
		perf.begin();
		
		this.ft.predict(text).then( function(labels) {
			self.logDebug(9, "Prediction complete", labels);
			
			// track elapsed in daily metrics
			var elapsed_ms = perf.end();
			var stats = self.server.Mendo.stats;
			stats.currentDay.ml_elapsed_ms = (stats.currentDay.ml_elapsed_ms || 0) + elapsed_ms;
			stats.currentDay.ml_count = (stats.currentDay.ml_count || 0) + 1;
			
			// extract tags from label data
			var tags = labels.map( function(label) {
				return label.label.toLowerCase();
			});
			
			process.nextTick( function() {
				callback(false, tags);
			});
		})
		.catch( function(err) {
			return callback(err);
		});
	}
	
	shutdown(callback) {
		this.logDebug(3, "ML subsystem shutting down");
		this.unload();
		callback();
	}

});
