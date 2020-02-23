// User Page -- Security Log

Page.MySecurity = class MySecurity extends Page.Base {
	
	onInit() {
		// called once at page load
		this.activity_types = {
			// '^user': '<i class="mdi mdi-account">&nbsp;</i>User',
			'^user_create': '<i class="mdi mdi-account-plus">&nbsp;</i>User',
			'^user_update': '<i class="mdi mdi-account-edit">&nbsp;</i>User',
			'^user_login': '<i class="mdi mdi-account-key">&nbsp;</i>User',
			'^message': '<i class="mdi mdi-email-outline">&nbsp;</i>Message',
			'^error': '<i class="mdi mdi-alert-decagram">&nbsp;</i>Error',
			'^warning': '<i class="mdi mdi-alert-circle">&nbsp;</i>Warning',
			'^notice': '<i class="mdi mdi-information-outline">&nbsp;</i>Notice'
		};
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '<i class="mdi mdi-shield-account">&nbsp;</i>User Security Log' );
		app.setWindowTitle( "User Security Log" );
		
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = 25;
		app.api.post( 'app/get_user_activity', copy_object(args), this.receive_activity.bind(this) );
		
		return true;
	}
	
	receive_activity(resp) {
		// receive page of activity from server, render it
		var self = this;
		var html = '';
		
		this.lastActivityResp = resp;
		this.events = [];
		if (resp.rows) this.events = resp.rows;
		
		var cols = ['Date/Time', 'Type', 'Description', 'User Agent', 'IP Address', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Recent User Activity';
			html += '<div class="box_subtitle" style="font-style:italic; color:var(--label-color);">This shows all your user account related activity, including each time you logged in.  If you see any IP addresses or other events that you do not recognize, it is recommended that you logout all sessions using the button below, and reset your password right afterward.  <a href="mailto:support@mendo.org">Contact our support team</a> if you have any questions.</div>';
		html += '</div>';
		html += '<div class="box_content table">';
		
		html += this.getPaginatedTable( resp, cols, 'event', function(item, idx) {
			
			// figure out icon first
			if (!item.action) item.action = 'unknown';
			
			var item_type = '';
			for (var key in self.activity_types) {
				var regexp = new RegExp(key);
				if (item.action.match(regexp)) {
					item_type = self.activity_types[key];
					break;
				}
			}
			
			// compose nice description
			var desc = '';
			var actions = [];
			var color = '';
			
			switch (item.action) {
				
				// users
				case 'user_create':
					desc = 'User created: <b>' + item.user.username + "</b> (" + item.user.full_name + ")";
				break;
				case 'user_update':
					desc = 'User account details updated.';
				break;
				case 'user_login':
					desc = 'User logged in.';
				break;
				
				// messages
				case 'message_post':
					if (item.message.type == 'reply') {
						desc = 'Reply posted: <b>' + encode_entities(item.message.subject) + '</b>';
						if (item.message.mail) desc += ' (via incoming e-mail)';
						actions.push( '<a href="#View?id=' + item.message.parent + '">View Thread</a>' );
					}
					else {
						desc = 'Topic posted: <b>' + encode_entities(item.message.subject) + '</b>';
						if (item.message.mail) desc += ' (via incoming e-mail)';
						actions.push( '<a href="#View?id=' + item.message.id + '">View Topic</a>' );
					}
				break;
				
				// misc
				case 'error':
					desc = encode_entities( item.description );
					color = 'red';
				break;
				case 'warning':
					desc = encode_entities( item.description );
					color = 'yellow';
				break;
				case 'notice':
					desc = encode_entities( item.description );
				break;
				
			} // switch action
			
			var tds = [
				'<div class="wrap_mobile">' + self.getNiceDateTimeText( item.epoch ) + '</div>',
				'<div class="td_big" style="white-space:nowrap; font-weight:normal;">' + item_type + '</div>',
				'<div class="activity_desc">' + desc + '</div>',
				'<div style="">' + (item.useragent || 'n/a') + '</div>',
				(item.ip || 'n/a').replace(/^\:\:ffff\:(\d+\.\d+\.\d+\.\d+)$/, '$1'),
				'<div style="white-space:nowrap;">' + (actions.join(' | ') || '-') + '</div>'
			];
			if (color) tds.className = color;
			
			return tds;
			
		} ); // getPaginatedTable
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button primary" onMouseUp="$P().logoutAll()">Logout All Sessions...</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
	}
	
	logoutAll() {
		// logout all sessions, for security purposes
		var html = '';
		
		html += '<form action="post">';
		html += '<div class="dialog_help" style="margin-bottom:0">This will <b>logout all sessions</b> associated with your account.  You should only need to do this if you suspect that your account has been compromised.  Your current session will not be affected.  It is highly recommended that you change your password after completing this step.</div>';
		html += '<div class="box_content" style="padding-bottom:15px;">';
		
		html += this.getFormRow({
			label: 'Password:',
			content: this.getFormText({
				id: 'fe_la_password',
				type: 'password',
				spellcheck: 'false',
				autocomplete: 'off'
			}),
			suffix: app.get_password_toggle_html(),
			caption: 'Enter your current account password.'
		});
		
		html += '</div>';
		html += '</form>';
		
		Dialog.confirm( '<span style="color:red">Logout Confirmation</span>', html, 'Confirm', function(result) {
			if (!result) return;
			var password = $('#fe_la_password').val();
			if (!password) return app.badField('#fe_la_password', "Please enter your current account password.");
			
			Dialog.showProgress( 1.0, "Logging out..." );
			
			app.api.post( 'app/logout_all', { password: password }, function(resp) {
				// processing in background
				Dialog.hideProgress();
				app.showMessage('success', "Your request was successfully enqueued for background processing.");
			} ); // api resp
		} ); // Dialog.confirm
		
		$('#fe_la_password').focus();
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
