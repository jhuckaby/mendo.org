// Mendo.org API Layer - Submission APIs
// Copyright (c) 2019 Joseph Huckaby
// Released under the MIT License

var fs = require('fs');
var assert = require("assert");
var async = require('async');
var Class = require('class-plus');
var Tools = require("pixl-tools");

module.exports = Class({

},
class Submit {
	
	api_search(args, callback) {
		// search for messages
		// { query, offset, limit, sort_by, sort_dir }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!this.requireParams(params, {
			query: /\S/
		}, callback)) return;
		
		params.offset = parseInt( params.offset || 0 );
		params.limit = parseInt( params.limit || 1 );
		
		if (!params.sort_by) params.sort_by = '_id';
		if (!params.sort_dir) params.sort_dir = -1;
		
		var compact = !!(params.compact == 1);
		delete params.compact;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			if (user.privileges.admin) {
				// admin user limits
				if (params.limit > 1000) params.limit = 1000;
			}
			else {
				// standard user limits
				if (params.limit > 100) params.limit = 100;
				if (params.verbose) delete params.verbose;
			}
			
			self.unbase.search( 'messages', params.query, params, function(err, results) {
				if (err) return self.doError('db', "Failed DB search: " + err, callback);
				
				if (results.total && !params.verbose) {
					// scrub verbose params and set fav bit
					var fav_re = user.username ? (new RegExp( "\\b" + user.username + "\\b", "i" )) : /(?!)/;
					
					results.records.forEach( function(record) {
						delete record.full;
						delete record.headers;
						
						// only show if current user has marked record as favorite, not all users
						record.fav = !!(record.favorites && record.favorites.match(fav_re));
						delete record.favorites;
						
						if (compact) delete record.body;
					});
				}
				
				// only allow private caching (because of fav_re)
				args.response.setHeader( 'Cache-Control', 'private, max-age=' + self.config.get('ttl') );
				
				results.code = 0;
				callback( results );
				
				self.updateDailyStat( 'search', 1 );
			}); // unbase.search
		}); // loadSession
	}
	
	api_view(args, callback) {
		// load single message (reply or topic)
		// { id }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!this.requireParams(params, {
			id: /^\w+$/
		}, callback)) return;
		
		this.loadSession(args, function (err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			self.unbase.get( 'messages', params.id, function(err, record) {
				if (err) return self.doError('view', "Message not found: " + err, callback);
				
				// only show if current user has marked record as favorite, not all users
				var fav_re = new RegExp( "\\b" + user.username + "\\b", "i" );
				record.fav = !!(record.favorites && record.favorites.match(fav_re));
				delete record.favorites;
				
				// only allow private caching
				args.response.setHeader( 'Cache-Control', 'private, max-age=' + self.config.get('ttl') );
				
				callback({ code: 0, data: record });
			}); // unbase.get
		}); // loadSession
	}
	
	api_doc(args, callback) {
		// load document (markdown)
		// { id }
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!this.requireParams(params, {
			id: /^\S+$/
		}, callback)) return;
		
		var file = 'docs/' + params.id + '.md';
		fs.readFile( file, 'utf8', function(err, data) {
			if (err) return self.doError('doc', "Document not found: " + params.id, callback);
			
			// allow public caching for this
			self.setCacheResponse( args, self.web.config.get('http_static_ttl') );
			
			callback({ code: 0, data: data });
		}); // fs.readFile
	}
	
});
