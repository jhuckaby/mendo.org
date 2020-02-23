// Mendo.org API Layer - Avatar
// Copyright (c) 2019 Joseph Huckaby

var fs = require('fs');
var assert = require("assert");
var Path = require('path');
var os = require('os');
var async = require('async');
var Jimp = require('jimp');
var Class = require('class-plus');
var Tools = require("pixl-tools");

module.exports = Class({
	
},
class Avatar {
	
	api_upload_avatar(args, callback) {
		// upload avatar for user
		var self = this;
		
		if (!args.files['file1']) {
			return self.doError('avatar', "No file upload data found in request.", callback);
		}
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var temp_file = args.files['file1'].path;
			var base_path = '/users/' + user.username + '/avatar';
			
			var sizes = [256, 64];
			
			async.eachSeries( sizes,
				function(size, callback) {
					self.resizeStoreImage( temp_file, size, size, base_path + '/' + size + '.png', callback );
				},
				function(err) {
					// all done with all image sizes
					if (err) return self.doError('avatar', err.toString(), callback);
					
					// update user to bump mod date (for cache bust on avatar)
					user.modified = Tools.timeNow(true);
					user.custom_avatar = Tools.timeNow(true);
					
					self.logDebug(6, "Updating user", user);
					
					self.storage.put( "users/" + self.usermgr.normalizeUsername(user.username), user, function(err, data) {
						if (err) {
							return self.doError('user', "Failed to update user: " + err, callback);
						}
						
						self.logDebug(6, "Successfully updated user");
						self.logTransaction('user_update', user.username, 
							self.getClientInfo(args, { user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1 } ) }));
						
						callback({ code: 0 });
					} ); // storage.put
				} // done with images
			); // eachSeries
		} ); // loaded session
	}
	
	api_admin_upload_avatar(args, callback) {
		// admin only: upload avatar for any user
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!args.files['file1']) {
			return self.doError('avatar', "No file upload data found in request.", callback);
		}
		
		if (!this.requireParams(params, {
			username: /^[\w\-\.]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, admin_user) {
			if (!session) {
				return self.doError('session', "Session has expired or is invalid.", callback);
			}
			if (!admin_user) {
				return self.doError('user', "User not found: " + session.username, callback);
			}
			if (!admin_user.active) {
				return self.doError('user', "User account is disabled: " + session.username, callback);
			}
			if (!admin_user.privileges.admin) {
				return self.doError('user', "User is not an administrator: " + session.username, callback);
			}
			
			self.loadUser( params.username, function(err, user) {
				if (err) {
					return self.doError('user', "User not found: " + params.username, callback);
				}
				
				var temp_file = args.files['file1'].path;
				var base_path = '/users/' + params.username + '/avatar';
				var sizes = [256, 64];
				
				async.eachSeries( sizes,
					function(size, callback) {
						self.resizeStoreImage( temp_file, size, size, base_path + '/' + size + '.png', callback );
					},
					function(err) {
						// all done with all image sizes
						if (err) return self.doError('avatar', err.toString(), callback);
						
						// update user to bump mod date (for cache bust on avatar)
						user.modified = Tools.timeNow(true);
						user.custom_avatar = Tools.timeNow(true);
						
						self.logDebug(6, "Updating user", user);
						
						self.storage.put( "users/" + self.usermgr.normalizeUsername(params.username), user, function(err, data) {
							if (err) {
								return self.doError('user', "Failed to update user: " + err, callback);
							}
							
							self.logDebug(6, "Successfully updated user");
							self.logTransaction('user_update', user.username, 
								self.getClientInfo(args, { user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1 } ) }));
							
							callback({ code: 0 });
						} ); // storage.put
					} // done with images
				); // eachSeries
			} ); // loadUser
		} ); // loaded session
	}
	
	api_delete_avatar(args, callback) {
		// delete avatar for user
		var self = this;
		
		this.loadSession(args, function(err, session, user) {
			if (err) return self.doError('session', err.message, callback);
			if (!self.requireValidUser(session, user, callback)) return;
			
			var base_path = '/users/' + user.username + '/avatar';
			var sizes = [256, 64];
			
			async.eachSeries( sizes,
				function(size, callback) {
					self.storage.delete( base_path + '/' + size + '.png', callback );
				},
				function(err) {
					// all done with all image sizes
					if (err) return self.doError('avatar', err.toString(), callback);
					
					// update user to bump mod date (for cache bust on avatar)
					user.modified = Tools.timeNow(true);
					delete user.custom_avatar;
					
					self.logDebug(6, "Updating user", user);
					
					self.storage.put( "users/" + self.usermgr.normalizeUsername(user.username), user, function(err, data) {
						if (err) {
							return self.doError('user', "Failed to update user: " + err, callback);
						}
						
						self.logDebug(6, "Successfully updated user");
						self.logTransaction('user_update', user.username, 
							self.getClientInfo(args, { user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1 } ) }));
						
						callback({ code: 0 });
					} ); // storage.put
				} // done with images
			); // eachSeries
		} ); // loaded session
	}
	
	api_admin_delete_avatar(args, callback) {
		// admin only: delete avatar for any user
		var self = this;
		var params = Tools.mergeHashes( args.params, args.query );
		
		if (!this.requireParams(params, {
			username: /^[\w\-\.]+$/
		}, callback)) return;
		
		this.loadSession(args, function(err, session, admin_user) {
			if (!session) {
				return self.doError('session', "Session has expired or is invalid.", callback);
			}
			if (!admin_user) {
				return self.doError('user', "User not found: " + session.username, callback);
			}
			if (!admin_user.active) {
				return self.doError('user', "User account is disabled: " + session.username, callback);
			}
			if (!admin_user.privileges.admin) {
				return self.doError('user', "User is not an administrator: " + session.username, callback);
			}
			
			self.loadUser( params.username, function(err, user) {
				if (err) {
					return self.doError('user', "User not found: " + params.username, callback);
				}
				
				var base_path = '/users/' + user.username + '/avatar';
				var sizes = [256, 64];
				
				async.eachSeries( sizes,
					function(size, callback) {
						self.storage.delete( base_path + '/' + size + '.png', callback );
					},
					function(err) {
						// all done with all image sizes
						if (err) return self.doError('avatar', err.toString(), callback);
						
						// update user to bump mod date (for cache bust on avatar)
						user.modified = Tools.timeNow(true);
						delete user.custom_avatar;
						
						self.logDebug(6, "Updating user", user);
						
						self.storage.put( "users/" + self.usermgr.normalizeUsername(user.username), user, function(err, data) {
							if (err) {
								return self.doError('user', "Failed to update user: " + err, callback);
							}
							
							self.logDebug(6, "Successfully updated user");
							self.logTransaction('user_update', user.username, 
								self.getClientInfo(args, { user: Tools.copyHashRemoveKeys( user, { password: 1, salt: 1 } ) }));
							
							callback({ code: 0 });
						} ); // storage.put
					} // done with images
				); // eachSeries
				
			} ); // loadUser
		} ); // loaded session
	}
	
	api_avatar(args, callback) {
		// view avatar for specified user on URI: /api/app/avatar/USERNAME.png
		var self = this;
		var size = parseInt( args.query.size || 256 );
		
		// currently supporting 64px and 256px sizes
		if (size > 64) size = 256;
		else size = 64;
		
		if (!args.request.url.match(/\/avatar\/(\w+)\.\w+(\?|$)/)) {
			return self.doError('avatar', "Invalid URL format", callback);
		}
		var username = RegExp.$1;
		var storage_key = '/users/' + username + '/avatar/' + size + '.png';
		
		this.storage.getStream( storage_key, function(err, stream) {
			if (err) {
				// use default avatar image instead
				stream = fs.createReadStream('htdocs/images/default.png');
			}
			
			callback( 
				"200 OK", 
				{
					"Content-Type": "image/png",
					"Cache-Control": "public, max-age=31536000"
				}, 
				stream 
			);
		} ); // getStream
	}
	
	resizeStoreImage(source_file, width, height, storage_key, callback) {
		// resize image to fit via jimp and store in storage
		var self = this;
		var fmt = Path.extname( storage_key ).replace(/^\./, '');
		if (!fmt) return callback( new Error("Storage key must have an extension: " + storage_key) );
		
		var temp_file = Path.join( os.tmpdir(), 'sb-image-temp-' + Tools.generateUniqueID() + '.' + fmt );
		this.logDebug(6, "Resizing image: " + source_file + " to " + width + "x" + height );
		
		Jimp.read(source_file, function(err, image) {
			if (err) return callback(err);
			
			// scale using fitover/autocrop
			image.cover(width, height);
			
			image.write(temp_file, function(err) {
				if (err) return callback(err);
				
				// store final file
				self.storage.putStream( storage_key, fs.createReadStream(temp_file), function(err) {
					if (err) return callback(err);
					
					// delete temp file, and we're done
					fs.unlink( temp_file, callback );
				} ); // put
			});
		}); // Jimp.read
	}
	
} );
