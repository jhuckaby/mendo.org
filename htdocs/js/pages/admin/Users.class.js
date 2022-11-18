// Admin Page -- Users

Page.Users = class Users extends Page.Base {
	
	onInit() {
		// called once at page load
		this.default_sub = 'list';
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		if (!args.sub) args.sub = this.default_sub;
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '<i class="mdi mdi-account-supervisor">&nbsp;</i>User Management' );
		
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// list all users
		app.setWindowTitle( "User List" );
		
		// show user list
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = 25;
		app.api.post( 'user/admin_get_users', copy_object(args), this.receive_users.bind(this) );
	}
	
	receive_users(resp) {
		// receive page of users from server, render it
		this.lastUsersResp = resp;
		var html = '';
		
		this.users = [];
		if (resp.rows) this.users = resp.rows;
		
		var cols = ['Username', 'Full Name', 'Email Address', 'Status', 'Type', 'Created', 'Actions'];
		
		html += '<div class="box">';
		
		html += '<div class="box_title">';
			html += 'User Accounts';
			html += '<div class="box_title_widget" style="overflow:visible"><i class="mdi mdi-magnify">&nbsp;</i><input type="text" size="15" id="fe_ul_search" placeholder="Find user..."/></div>';
			html += '<div class="clear"></div>';
		html += '</div>';
		
		html += '<div class="box_content table">';
		
		var self = this;
		html += this.getPaginatedTable( resp, cols, 'user', function(user, idx) {
			var actions = [
				'<span class="link" onMouseUp="$P().edit_user('+idx+')"><b>Edit</b></span>',
				'<span class="link" onMouseUp="$P().delete_user('+idx+')"><b>Delete</b></span>'
			];
			var avatar_url = '';
			if (user.avatar) avatar_url = user.avatar.replace(/^\w+\:/, '');
			else avatar_url = '/api/app/avatar/' + user.username + '.png?size=64&mod=' + (user.custom_avatar || 0);
			
			return [
				self.getNiceUsername(user.username, true),
				// '<a href="#Users?sub=edit&username=' + user.username + '"><div class="td_avatar" style="background-image:url(' + avatar_url + ')">' + user.username + '</div></a>',
				user.full_name,
				'<a href="mailto:'+user.email+'">'+user.email+'</a>',
				user.active ? '<span class="color_label green"><i class="mdi mdi-check-circle">&nbsp;</i>Active</span>' : '<span class="color_label red"><i class="mdi mdi-alert-circle">&nbsp;</i>Suspended</span>',
				user.privileges.admin ? '<span class="color_label purple"><i class="mdi mdi-lock">&nbsp;</i>Admin</span>' : '<span class="color_label gray">Standard</span>',
				'<span title="'+get_nice_date_time(user.created, true)+'">'+get_nice_date(user.created, true)+'</span>',
				actions.join(' | ')
			];
		} );
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button primary" onMouseUp="$P().edit_user(-1)">Add User...</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		setTimeout( function() {
			$('#fe_ul_search').keypress( function(event) {
				if (event.keyCode == '13') { // enter key
					event.preventDefault();
					$P().do_user_search( $('#fe_ul_search').val() );
				}
			} )
			.blur( function() { app.hideMessage(250); } )
			.keydown( function() { app.hideMessage(); } );
		}, 1 );
	}
	
	do_user_search(text) {
		// see if user exists, edit if so
		if (text.match(/\@/)) {
			// lookup_user from email
			app.api.post( 'app/lookup_user', { email: text }, 
				function(resp) {
					Nav.go('Users?sub=edit&username=' + resp.user.username);
				},
				function(resp) {
					app.doError("User not found: " + text, 10);
				}
			);
		}
		else {
			// exact username
			app.api.post( 'user/admin_get_user', { username: text }, 
				function(resp) {
					Nav.go('Users?sub=edit&username=' + text);
				},
				function(resp) {
					app.doError("User not found: " + text, 10);
				}
			);
		}
	}
	
	edit_user(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Users?sub=edit&username=' + this.users[idx].username );
		else if (app.config.external_users) {
			app.doError("Users are managed by an external system, so you cannot add them from here.");
		}
		else Nav.go( '#Users?sub=new' );
	}
	
	delete_user(idx) {
		// delete user from search results
		this.user = this.users[idx];
		this.show_delete_account_dialog();
	}
	
	gosub_new(args) {
		// create new user
		var html = '';
		app.setWindowTitle( "Add New User" );
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Add New User';
			html += '<div class="box_subtitle"><a href="#Users?sub=list">&laquo; Back to User List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.user = { 
			active: 1,
			privileges: copy_object( config.default_privileges )
		};
		
		html += this.get_user_edit_html();
		
		// notify user
		html += this.getFormRow({
			label: 'Notify:',
			content: this.getFormCheckbox({
				id: 'fe_eu_send_email',
				checked: true,
				label: "Send Welcome Email"
			}),
			caption: 'Select notification options for the new user.'
		});
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_user_edit()">Cancel</div>';
			if (config.debug) html += '<div class="button" onMouseUp="$P().populate_random_user()">Randomize...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_new_user()"><i class="mdi mdi-floppy">&nbsp;</i>Create User</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		$('#fe_eu_username').focus();
	}
	
	cancel_user_edit() {
		// cancel editing user and return to list
		Nav.go( 'Users?sub=list' );
	}
	
	populate_random_user() {
		// grab random user data (for testing only)
		var self = this;
		
		$.ajax({
			url: 'https://api.randomuser.me/',
			dataType: 'json',
			success: function(data){
				// console.log(data);
				if (data.results && data.results[0] && data.results[0]) {
					var user = data.results[0];
					$('#fe_eu_username').val( user.login.username );
					$('#fe_eu_email').val( user.email );
					$('#fe_eu_fullname').val( ucfirst(user.name.first) + ' ' + ucfirst(user.name.last) );
					$('#fe_eu_send_email').prop( 'checked', false );
					self.generate_password();
					self.checkUserExists( $('#fe_eu_username')[0] );
				}
			}
		});
	}
	
	do_new_user() {
		// create new user
		app.clearError();
		var user = this.get_user_form_json();
		if (!user) return; // error
		
		if (!user.username.length) {
			return app.badField('#fe_eu_username', "Please enter a username for the new account.");
		}
		if (!user.username.match(/^\w+$/)) {
			return app.badField('#fe_eu_username', "Please make sure the username contains only alphanumerics.");
		}
		if (!user.email.length) {
			return app.badField('#fe_eu_email', "Please enter an e-mail address where the user can be reached.");
		}
		if (!user.email.match(/^\S+\@\S+$/)) {
			return app.badField('#fe_eu_email', "The e-mail address you entered does not appear to be correct.");
		}
		if (!user.full_name.length) {
			return app.badField('#fe_eu_fullname', "Please enter the user's first and last names.");
		}
		if (!user.password.length) {
			return app.badField('#fe_eu_password', "Please enter a secure password to protect the account.");
		}
		
		user.send_email = $('#fe_eu_send_email').is(':checked') ? 1 : 0;
		
		this.user = user;
		
		Dialog.showProgress( 1.0, "Creating user..." );
		app.api.post( 'user/admin_create', user, this.new_user_finish.bind(this) );
	}
	
	new_user_finish(resp) {
		// new user created successfully
		Dialog.hideProgress();
		
		// Nav.go('Users?sub=edit&username=' + this.user.username);
		Nav.go( 'Users?sub=list' );
		
		app.showMessage('success', "The new user account was created successfully.");
	}
	
	gosub_edit(args) {
		// edit user subpage
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		
		// setup upload system
		ZeroUpload.setURL( '/api/app/admin_upload_avatar' );
		ZeroUpload.setMaxFiles( 1 );
		ZeroUpload.setMaxBytes( 1 * 1024 * 1024 ); // 1 MB
		ZeroUpload.setFileTypes( "image/jpeg", "image/png", "image/gif" );
		ZeroUpload.on('start', this.upload_start.bind(this) );
		ZeroUpload.on('progress', this.upload_progress.bind(this) );
		ZeroUpload.on('complete', this.upload_complete.bind(this) );
		ZeroUpload.on('error', this.upload_error.bind(this) );
		ZeroUpload.init();
		
		app.api.post( 'user/admin_get_user', { username: args.username }, this.receive_user.bind(this) );
	}
	
	receive_user(resp) {
		// edit existing user
		var html = '';
		app.setWindowTitle( "Editing User \"" + (this.args.username) + "\"" );
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Editing User &ldquo;' + (this.args.username) + '&rdquo;';
			html += '<div class="box_subtitle"><a href="#Users?sub=list">&laquo; Back to User List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.user = resp.user;
		
		html += this.get_user_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_user_edit()">Cancel</div>';
			html += '<div class="button" onMouseUp="$P().show_delete_account_dialog()">Delete Account...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_save_user()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('select[multiple]') );
		$('#fe_eu_username').attr('disabled', true);
		
		if (app.config.external_users) {
			app.showMessage('warning', "Users are managed by an external system, so making changes here may have little effect.");
		}
	}
	
	upload_avatar() {
		// upload profile pic using ZeroUpload
		ZeroUpload.chooseFiles({
			session_id: app.getPref('session_id'),
			username: this.user.username
		});
	}
	
	upload_start(files, userData) {
		// avatar upload has started
		Dialog.showProgress( 0.0, "Uploading image..." );
		Debug.trace('avatar', "Upload started");
	}
	
	upload_progress(progress) {
		// avatar is on its way
		Dialog.showProgress( progress.amount );
		Debug.trace('avatar', "Upload progress: " + progress.pct);
	}
	
	upload_complete(response, userData) {
		// avatar upload has completed
		Dialog.hideProgress();
		Debug.trace('avatar', "Upload complete!", response.data);
		
		var data = null;
		try { data = JSON.parse( response.data ); }
		catch (err) {
			app.doError("Image Upload Failed: JSON Parse Error: " + err);
		}
		
		if (data && (data.code != 0)) {
			app.doError("Image Upload Failed: " + data.description);
		}
		
		var avatar_url = '/api/app/avatar/' + this.user.username + '.png?size=128&random=' + Math.random();
		$('#d_eu_image').css( 'background-image', 'url(' + avatar_url + ')' );
	}
	
	upload_error(type, message, userData) {
		// avatar upload error
		Dialog.hideProgress();
		app.doError("Image Upload Failed: " + message);
	}
	
	delete_avatar() {
		// delete user avatar
		var self = this;
		
		app.api.post( 'app/admin_delete_avatar', {
			username: this.user.username
		}, 
		function(resp) {
			// finished deleting
			var avatar_url = '/api/app/avatar/' + self.user.username + '.png?size=128&random=' + Math.random();
			$('#d_eu_image').css( 'background-image', 'url(' + avatar_url + ')' );
		} );
	}
	
	do_save_user() {
		// save changes to user
		app.clearError();
		var user = this.get_user_form_json();
		if (!user) return; // error
		
		// if changing password, give server a hint
		if (user.password) {
			user.new_password = user.password;
			delete user.password;
		}
		
		this.user = user;
		Dialog.showProgress( 1.0, "Saving user account..." );
		
		app.api.post( 'user/admin_update', this.user, this.save_user_finish.bind(this) );
	}
	
	save_user_finish(resp, tx) {
		// user saved successfully
		Dialog.hideProgress();
		Nav.go( 'Users?sub=list' );
		app.showMessage('success', "The user was saved successfully.");
		
		// if we edited ourself, update header
		if (this.args.username == app.username) {
			app.user = resp.user;
			app.updateHeaderInfo();
		}
	}
	
	show_delete_account_dialog() {
		// show dialog confirming account delete action
		var self = this;
		
		var msg = "Are you sure you want to <b>permanently delete</b> the user account &ldquo;" + this.user.username + "&rdquo;?  There is no way to undo this action, and no way to recover the data.";
		
		if (app.config.external_users) {
			msg = "Are you sure you want to delete the user account &ldquo;" + this.user.username + "&rdquo;?  Users are managed by an external system, so this will have little effect here.";
		}
		
		Dialog.confirm( '<span style="color:red">Delete Account</span>', msg, 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Account..." );
				app.api.post( 'user/admin_delete', {
					username: self.user.username
				}, self.delete_user_finish.bind(self) );
			}
		} );
	}
	
	delete_user_finish(resp, tx) {
		// finished deleting, immediately log user out
		Dialog.hideProgress();
		
		Nav.go('Users?sub=list', 'force');
		app.showMessage('success', "The user account &ldquo;" + this.user.username + "&rdquo; was deleted successfully.");
	}
	
	get_user_edit_html() {
		// get html for editing a user (or creating a new one)
		var html = '';
		var user = this.user;
		
		// user id
		html += this.getFormRow({
			label: 'Username:',
			content: this.getFormText({
				id: 'fe_eu_username',
				class: 'monospace',
				spellcheck: 'false',
				onChange: '$P().checkUserExists(this)',
				value: user.username
			}),
			suffix: '<div class="checker"></div>',
			caption: 'Enter the username which identifies this account.  Once entered, it cannot be changed.'
		});
		
		// status
		html += this.getFormRow({
			label: 'Account Status:',
			content: this.getFormMenu({
				id: 'fe_eu_status',
				options: [[1,'Active'], [0,'Suspended']],
				value: user.active
			}),
			caption: '&ldquo;Suspended&rdquo; means that the account remains in the system, but the user cannot log in.'
		});
		
		// full name
		html += this.getFormRow({
			label: 'Full Name:',
			content: this.getFormText({
				id: 'fe_eu_fullname',
				spellcheck: 'false',
				value: user.full_name
			}),
			caption: 'User‘s first and last names.  This will not be shared with anyone outside the server.'
		});
		
		// email
		html += this.getFormRow({
			label: 'Email Address:',
			content: this.getFormText({
				id: 'fe_eu_email',
				spellcheck: 'false',
				value: user.email
			}),
			caption: 'This can be used to recover the password if the user forgets.  It will not be shared with anyone outside the server.'
		});
		
		// password
		html += this.getFormRow({
			label: user.modified ? 'Change Password:' : 'Password:',
			content: this.getFormText({
				// type: 'password',
				id: 'fe_eu_password',
				spellcheck: 'false',
				value: ''
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-dice-5" title="Generate Random Password" onMouseUp="$P().generate_password()"></div>',
			caption: user.modified ? "Optionally enter a new password here to reset it.  Please make it secure." : "Enter a password for the account.  Please make it secure."
		});
		
		// privilege list
		html += this.getFormRow({
			label: 'Privileges:',
			content: this.getFormMenuMulti({
				id: 'fe_eu_privs',
				title: 'Select Privileges',
				placeholder: 'Click to assign privileges...',
				options: config.privilege_list,
				values: hash_keys_to_array( user.privileges ),
				onChange: '$P().onPrivChange(this)',
				'data-admin_set': user.privileges.admin ? 1 : ''
			}),
			caption: 'Select which privileges the user account should have. Administrators have <b>all</b> privileges.'
		});
		
		// verified
		html += this.getFormRow({
			label: 'Verified:',
			content: this.getFormCheckbox({
				id: 'fe_eu_verified',
				checked: !!user.verified,
				label: "Verified E-mail"
			}),
			caption: 'This controls whether the user has a verified e-mail or not.  Please set this with care.'
		});
		
		// opt-out
		html += this.getFormRow({
			label: 'Opt-Out:',
			content: this.getFormCheckbox({
				id: 'fe_eu_opt_out',
				checked: !!user.opt_out,
				label: "Opt-Out From ListServ Ingest"
			}),
			caption: 'Check this box only if you want the user to be completely opted-out from ListServ e-mail ingest.'
		});
		
		return html;
	}
	
	onPrivChange(elem) {
		// privileges changed, resolve "admin is god" thing here
		var $elem = $(elem);
		var priv_list = $elem.val();
		var is_admin = find_in_array(priv_list, 'admin');
		
		if (is_admin && (priv_list.length > 1)) {
			if ($elem.data('admin_set')) {
				// user tried to add another priv with admin set, so deactivate admin
				var admin = find_object( elem.options, { value: 'admin' } );
				admin.selected = false;
				$elem.trigger('change');
				is_admin = false;
			}
			else {
				// user tried to add admin with other privs, so set admin to be solo
				$elem.val(['admin']).trigger('change');
				is_admin = true;
			}
		}
		
		$elem.data('admin_set', is_admin);
	}
	
	get_user_form_json() {
		// get user elements from form, used for new or edit
		var user = {
			username: trim($('#fe_eu_username').val().toLowerCase()),
			active: parseInt( $('#fe_eu_status').val() ),
			full_name: trim($('#fe_eu_fullname').val()),
			email: trim($('#fe_eu_email').val()),
			password: $('#fe_eu_password').val(),
			privileges: array_to_hash_keys( $('#fe_eu_privs').val(), 1 ),
			verified: !!$('#fe_eu_verified').is(':checked'),
			opt_out: !!$('#fe_eu_opt_out').is(':checked')
		};
		
		return user;
	}
	
	generate_password() {
		// generate random-ish password
		$('#fe_eu_password').val( get_unique_id(8) + '-' + get_unique_id(8) );
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
