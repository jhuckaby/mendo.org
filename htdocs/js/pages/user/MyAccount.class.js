
Page.MyAccount = class MyAccount extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle('My Account');
		app.setHeaderTitle( '<i class="mdi mdi-account">&nbsp;</i>User Management' );
		app.showSidebar(true);
		
		// setup upload system
		ZeroUpload.setURL( '/api/app/upload_avatar' );
		ZeroUpload.setMaxFiles( 1 );
		ZeroUpload.setMaxBytes( 1 * 1024 * 1024 ); // 1 MB
		ZeroUpload.setFileTypes( "image/jpeg", "image/png", "image/gif" );
		ZeroUpload.on('start', this.uploadStart.bind(this) );
		ZeroUpload.on('progress', this.uploadProgress.bind(this) );
		ZeroUpload.on('complete', this.uploadComplete.bind(this) );
		ZeroUpload.on('error', this.uploadError.bind(this) );
		ZeroUpload.init();
		
		this.receiveUser({ user: app.user });
		return true;
	}
	
	receiveUser(resp, tx) {
		var self = this;
		var user = resp.user;
		
		var html = '';
		html += '<form action="post">';
		
		html += '<div class="box">';
		html += '<div class="box_title">My Account</div>';
		html += '<div class="box_content">';
		
		// user id
		html += this.getFormRow({
			label: 'Username:',
			content: this.getFormText({
				id: 'fe_ma_username',
				class: 'monospace',
				disabled: true,
				autocomplete: 'off',
				value: app.username
			}),
			caption: 'Your username cannot be changed.'
		});
		
		// full name
		html += this.getFormRow({
			label: 'Full Name:',
			content: this.getFormText({
				id: 'fe_ma_fullname',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 64,
				value: user.full_name
			}),
			caption: 'Your first and last names, used for display purposes only.'
		});
		
		// email
		html += this.getFormRow({
			label: 'Email Address:',
			content: this.getFormText({
				id: 'fe_ma_email',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 64,
				value: user.email,
				onChange: '$P().checkEmailChanged(this)'
			}),
			suffix: '<div class="verifier"></div>',
			caption: 'This is used for sending your posts and replies to the ListServ, and for resetting your password.'
		});
		
		// current password
		html += this.getFormRow({
			label: 'Current Password:',
			content: this.getFormText({
				type: 'password',
				id: 'fe_ma_old_password',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 64,
				value: ''
			}),
			suffix: app.get_password_toggle_html(),
			caption: "Enter your current account password to make changes."
		});
		
		// new password
		html += this.getFormRow({
			label: 'New Password:',
			content: this.getFormText({
				type: 'password',
				id: 'fe_ma_new_password',
				spellcheck: 'false',
				autocomplete: 'off',
				maxlength: 64,
				value: ''
			}),
			suffix: app.get_password_toggle_html(),
			caption: "If you need to change your password, enter the new one here."
		});
		
		// timezone
		/* var zones = [
			['', "Auto-Detect (" + app.auto_tz + ")"]
		].concat(app.zones);
		
		html += this.getFormRow({
			label: 'Timezone:',
			content: this.getFormMenuSingle({
				id: 'fe_ma_tz',
				title: 'Select Timezone',
				options: zones,
				value: user.timezone || ''
			}),
			caption: 'Select your desired timezone for displaying local dates and times.'
		}); */
		
		// avatar
		/* var ava_html = '';
		ava_html += '<div class="simple_grid_horiz">';
		ava_html += '<div id="d_ma_image" class="avatar_edit" style="background-image:url(' + app.getUserAvatarURL(128) + ')" onMouseUp="$P().uploadAvatar()"></div>';
		if (!app.config.external_users) {
			ava_html += '<div class="button small" title="Delete Avatar Image" onMouseUp="$P().deleteAvatar()">&laquo; Delete</div>';
		}
		ava_html += '</div>';
		html += this.getFormRow({
			label: 'Avatar:',
			content: ava_html,
			caption: app.config.external_users ? "" : "Optionally upload a custom avatar image for your user."
		}); */
		
		// opt-out
		html += this.getFormRow({
			label: 'Opt-Out:',
			content: this.getFormCheckbox({
				id: 'fe_ma_opt_out',
				checked: !!user.opt_out,
				label: "Opt-Out From ListServ Ingest",
				onChange: '$P().verifyOptOut()'
			}),
			caption: 'Check this box only if you want to completely opt-out from ListServ e-mail ingest.  This means that ' + config.name + ' will <b>not</b> process any ListServ e-mail coming from your e-mail address.'
		});
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().showDeleteAccountDialog()">Delete Account...</div>';
			html += '<div class="button primary" onMouseUp="$P().saveChanges()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		html += '</form>';
		this.div.html( html );
		this.div.find('#fe_ma_email').trigger('change');
		
		// SingleSelect.init( this.div.find('#fe_ma_tz') );
		
		if (app.config.external_users) {
			app.showMessage('warning', "Users are managed by an external system, so some fields are locked.");
			self.div.find('input').prop('disabled', true);
		}
	}
	
	verifyOptOut() {
		// show confirmation, also check for verified e-mail
		var self = this;
		if (!this.div.find('#fe_ma_opt_out').is(':checked')) return;
		
		if (!app.user.verified) {
			this.div.find('#fe_ma_opt_out').prop('checked', false);
			app.doError("Please verify your e-mail address before opting out.");
			return;
		}
		
		var html = '';
		html += 'Please confirm that you want to <b>completely opt-out</b> from all ListServ e-mail ingest.  This means that ' + config.name + ' will not show any of your e-mails that you send to the ListServ from this point onward.';
		
		html += '<br/><br/>Make sure you save changes after confirming.';
		
		Dialog.confirm('<span style="color:red">Opt-Out Confirmation</span>', html, "Confirm", function(ok) {
			if (!ok) {
				self.div.find('#fe_ma_opt_out').prop('checked', false);
				return; // user canceled
			}
			Dialog.hide();
		}); // Dialog.confirm
	}
	
	checkEmailChanged(field) {
		// update e-mail verification status
		// called after field changes
		var $field = $(field);
		var email = trim( $field.val() );
		var $elem = $field.closest('.form_row').find('.fr_suffix .verifier');
		
		if (email === app.user.email) {
			if (app.user.verified) {
				$elem.css('color','green').html('<i class="mdi mdi-check-circle">&nbsp;&nbsp;</i><b>Verified</b>');
				$field.removeClass('warning');
			}
			else {
				$elem.css('color','red').html('<span class="nowrap"><i class="mdi mdi-alert-circle">&nbsp;&nbsp;</i><b>Unverified</b></span>&nbsp; <span class="link" onMouseUp="$P().showVerifyDialog()">(What\'s&nbsp;this?)</span>');
				// $field.addClass('warning');
			}
		}
		else {
			$elem.html('');
		}
	}
	
	showVerifyDialog() {
		// show dialog with e-mail verification explanation, and a link to re-send
		// confirm: function(title, html, ok_btn_label, callback) {
		var html = '';
		
		html += config.name + ' needs to verify that you "own" your e-mail address.  This is done by sending you a special welcome e-mail to your address when you first created your account.  The e-mail contains a special link that confirms the verification when clicked.  This action allows ' + config.name + ' to then send e-mails to the ListServ on your behalf.<br/><br/>';
		
		html += 'If you did not receive the e-mail, you can have it resent here.  To insure that the e-mail is not flagged as spam, please add "' + config.email_from + '" to your address book.';
		
		Dialog.confirm("Email Verification", html, "Resend Verification", function(ok) {
			if (!ok) return; // user canceled
			Dialog.hide();
			
			app.api.post( 'app/send_email_verification', {}, function(resp) {
				app.showMessage('success', "Verification e-mail sent successfully.  Please check your e-mail in a few minutes.");
			} );
		}); // Dialog.confirm
	}
	
	uploadAvatar() {
		// upload profile pic using ZeroUpload
		ZeroUpload.chooseFiles({
			session_id: app.getPref('session_id')
		});
	}
	
	uploadStart(files, userData) {
		// avatar upload has started
		Dialog.showProgress( 0.0, "Uploading image..." );
		Debug.trace('avatar', "Upload started");
	}
	
	uploadProgress(progress) {
		// avatar is on its way
		Dialog.showProgress( progress.amount );
		Debug.trace('avatar', "Upload progress: " + progress.pct);
	}
	
	uploadComplete(response, userData) {
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
		
		$('#d_ma_image').css( 'background-image', 'url('+app.getUserAvatarURL(128, true)+')' );
		app.updateHeaderInfo(true);
	}
	
	uploadError(type, message, userData) {
		// avatar upload error
		Dialog.hideProgress();
		app.doError("Image Upload Failed: " + message);
		$('#d_ma_image').css( 'background-image', 'url('+app.getUserAvatarURL(128)+')' );
	}
	
	deleteAvatar() {
		// delete user avatar
		app.api.post( 'app/delete_avatar', {
			username: app.username
		}, 
		function(resp) {
			// finished deleting
			$('#d_ma_image').css( 'background-image', 'url('+app.getUserAvatarURL(128, true)+')' );
			app.updateHeaderInfo(true);
		} );
	}
	
	saveChanges() {
		// save changes to user info
		app.clearError();
		if (app.config.external_users) {
			return app.doError("Users are managed by an external system, so you cannot make changes here.");
		}
		
		var full_name = trim($('#fe_ma_fullname').val());
		var email = trim($('#fe_ma_email').val());
		var old_password = $('#fe_ma_old_password').val();
		var new_password = $('#fe_ma_new_password').val();
		var opt_out = !!$('#fe_ma_opt_out').is(':checked');
		// var timezone = $('#fe_ma_tz').val();
		
		if (!old_password.length) {
			return app.badField('#fe_ma_old_password', "Please enter your current account password to make changes.");
		}
		
		Dialog.showProgress( 1.0, "Saving account..." );
		
		app.api.post( 'user/update', {
			username: app.username,
			full_name: full_name,
			email: email,
			old_password: old_password,
			new_password: new_password,
			opt_out: opt_out
			// timezone: timezone
		}, 
		function(resp) {
			// save complete
			Dialog.hideProgress();
			app.showMessage('success', "Your account settings were updated successfully.");
			
			$('#fe_ma_old_password').val('');
			$('#fe_ma_new_password').val('');
			
			app.user = resp.user;
			// app.tz = app.user.timezone || app.auto_tz;
			// app.updateHeaderInfo();
			// $('#d_ma_image').css( 'background-image', 'url('+app.getUserAvatarURL(128)+')' );
			
			// this may have changed on the server (if user changed their e-mail for example)
			$('#fe_ma_opt_out').prop('checked', app.user.opt_out);
		} );
	}
	
	showDeleteAccountDialog() {
		// show dialog confirming account delete action
		var self = this;
		
		app.clearError();
		if (app.config.external_users) {
			return app.doError("Users are managed by an external system, so you cannot make changes here.");
		}
		if (!$('#fe_ma_old_password').val()) return app.badField('#fe_ma_old_password', "Please enter your current account password.");
		
		Dialog.confirm( '<span style="color:red">Delete My Account</span>', "Are you sure you want to <b>permanently delete</b> your user account?  There is no way to undo this action, and no way to recover your data.", "Delete", function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Account..." );
				app.api.post( 'user/delete', {
					username: app.username,
					password: $('#fe_ma_old_password').val()
				}, 
				function(resp) {
					// finished deleting, immediately log user out
					app.doUserLogout();
				} );
			}
		} );
	}
	
	onDeactivate() {
		// called when page is deactivated
		// this.div.html( '' );
		return true;
	}
	
};
