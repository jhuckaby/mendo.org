// Admin Page -- Ban Config

Page.Bans = class Bans extends Page.Base {
	
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
		app.setHeaderTitle( '<i class="mdi mdi-target-account">&nbsp;</i>Global Bans' );
		
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show ban list
		app.setWindowTitle( "Global Bans" );
		
		// use bans in app cache
		this.receive_bans({
			code: 0,
			rows: app.bans,
			list: { length: app.bans.length }
		});
	}
	
	getNiceBan(ban, link) {
		// get formatted ban with icon, plus optional link
		if (!ban) return '(None)';
		if (typeof(ban) == 'string') {
			var ban_def = find_object( app.bans, { id: ban } );
			if (ban_def) ban = ban_def;
			else ban = { id: ban, email: ban };
		}
		
		var html = '';
		var icon = '<i class="mdi mdi-target-account">&nbsp;</i>';
		if (link) {
			if (link === true) link = '#Bans?sub=edit&id=' + ban.id;
			html += '<a href="' + link + '" style="text-decoration:none">';
			html += icon + '<span style="text-decoration:underline">' + ban.email + '</span></a>';
		}
		else {
			html += icon + ban.email;
		}
		
		return html;
	}
	
	receive_bans(resp) {
		// receive all bans from server, render them sorted
		var html = '';
		if (!resp.rows) resp.rows = [];
		
		// sort by custom sort order
		this.bans = resp.rows.sort( function(a, b) {
			return a.id.localeCompare( b.id );
		} );
		
		var cols = ['Email', 'ID', 'Author', 'Created', 'Expires', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'All Bans';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var self = this;
		html += this.getBasicTable( this.bans, cols, 'ban', function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onMouseUp="$P().edit_ban('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link" onMouseUp="$P().delete_ban('+idx+')"><b>Delete</b></span>' );
			
			var nice_expires = '';
			if (item.expires) {
				nice_expires = '<span title="' + get_nice_date_time(item.expires, true) + '">' + get_nice_date(item.expires, true) + '</span>';
			}
			else {
				nice_expires = "(Infinite)";
			}
			
			return [
				'<div class="td_big">' + self.getNiceBan(item, '#Bans?sub=edit&id=' + item.id) + '</div>',
				'<div class="mono">' + item.id + '</div>',
				self.getNiceUsername(item.username, true),
				'<span title="' + get_nice_date_time(item.created, true) + '">' + get_nice_date(item.created, true) + '</span>',
				nice_expires,
				actions.join(' | ')
			];
		} ); // getBasicTable
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button primary" onMouseUp="$P().edit_ban(-1)">Add Ban...</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
	}
	
	edit_ban(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Bans?sub=edit&id=' + this.bans[idx].id );
		else Nav.go( '#Bans?sub=new' );
	}
	
	delete_ban(idx) {
		// delete ban from search results
		this.ban = this.bans[idx];
		this.show_delete_ban_dialog();
	}
	
	gosub_new(args) {
		// create new ban
		var html = '';
		app.setWindowTitle( "New Global Ban" );
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Global Ban';
			html += '<div class="box_subtitle"><a href="#Bans?sub=list">&laquo; Back to Ban List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.ban = {
			id: "",
			email: "",
			expires: 0,
			notes: ""
		};
		
		html += this.get_ban_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_ban_edit()">Cancel</div>';
			html += '<div class="button primary" onMouseUp="$P().do_new_ban()"><i class="mdi mdi-floppy">&nbsp;</i>Create Ban</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		$('#fe_eb_email').focus();
	}
	
	cancel_ban_edit() {
		// cancel editing ban and return to list
		Nav.go( '#Bans?sub=list' );
	}
	
	do_new_ban(force) {
		// create new ban
		app.clearError();
		var ban = this.get_ban_form_json();
		if (!ban) return; // error
		
		this.ban = ban;
		
		Dialog.showProgress( 1.0, "Adding Ban..." );
		app.api.post( 'app/create_ban', ban, this.new_ban_finish.bind(this) );
	}
	
	new_ban_finish(resp) {
		// new ban created successfully
		Dialog.hideProgress();
		
		// refresh client-side ban list and sidebar
		this.ban = resp.ban;
		app.bans.push( this.ban );
		
		Nav.go('Bans?sub=list');
		app.showMessage('success', "The new global ban was created successfully.");
	}
	
	gosub_edit(args) {
		// edit ban subpage
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		app.api.post( 'app/get_ban', { id: args.id }, this.receive_ban.bind(this) );
	}
	
	receive_ban(resp) {
		// edit existing ban
		var html = '';
		this.ban = resp.ban;
		
		app.setWindowTitle( "Editing Global Ban \"" + (this.ban.email) + "\"" );
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Editing Ban &ldquo;' + (this.ban.email) + '&rdquo;';
				html += '<div class="box_subtitle"><a href="#Bans?sub=list">&laquo; Back to Ban List</a></div>';
			html += '</div>';
		html += '<div class="box_content">';
		
		// ban id
		html += this.getFormRow({
			label: 'Ban ID:',
			content: this.getFormText({
				id: 'fe_eb_id',
				class: 'monospace',
				spellcheck: 'false',
				disabled: 'disabled',
				value: this.ban.id
			}),
			caption: 'A unique ID for the ban, used internally.  This cannot be changed.'
		});
		
		html += this.get_ban_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_ban_edit()">Cancel</div>';
			html += '<div class="button" onMouseUp="$P().show_delete_ban_dialog()">Delete Ban...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_save_ban()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
	}
	
	do_save_ban() {
		// save changes to ban
		app.clearError();
		var ban = this.get_ban_form_json();
		if (!ban) return; // error
		
		this.ban = ban;
		
		Dialog.showProgress( 1.0, "Saving Changes..." );
		app.api.post( 'app/update_ban', ban, this.save_ban_finish.bind(this) );
	}
	
	save_ban_finish(resp, tx) {
		// new ban saved successfully
		Dialog.hideProgress();
		
		// refresh client-side ban list and sidebar
		var ban = find_object( app.bans, { id: this.ban.id } );
		if (ban) merge_hash_into( ban, this.ban );
		
		Nav.go( 'Bans?sub=list' );
		app.showMessage('success', "The global ban was saved successfully.");
	}
	
	show_delete_ban_dialog() {
		// show dialog confirming ban delete action
		var self = this;
		
		Dialog.confirm( '<span style="color:red">Delete Ban</span>', "Are you sure you want to <b>permanently delete</b> the global ban &ldquo;<b>" + this.ban.email + "</b>&rdquo;?  There is no way to undo this action.", 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Ban..." );
				app.api.post( 'app/delete_ban', self.ban, self.delete_ban_finish.bind(self) );
			}
		} );
	}
	
	delete_ban_finish(resp, tx) {
		// finished deleting ban
		var self = this;
		Dialog.hideProgress();
		
		// refresh client-side ban list and sidebar
		var idx = find_object_idx( app.bans, { id: this.ban.id } );
		if (idx > -1) app.bans.splice( idx, 1 );
		
		Nav.go('Bans?sub=list', 'force');
		app.showMessage('success', "The global ban &ldquo;" + this.ban.email + "&rdquo; was deleted successfully.");
	}
	
	get_ban_edit_html() {
		// get html for editing an ban (or creating a new one)
		var html = '';
		var ban = this.ban;
		
		// email
		html += this.getFormRow({
			label: 'Ban Email:',
			content: this.getFormText({
				id: 'fe_eb_email',
				spellcheck: 'false',
				value: ban.email
			}),
			caption: 'Enter the full e-mail address (or partial match) to be banned from all ingest processing.'
		});
		
		// exp date
		html += this.getFormRow({
			label: 'Expiration:',
			content: this.getFormText({
				id: 'fe_eb_expires',
				spellcheck: 'false',
				placeholder: 'YYYY/MM/DD',
				value: ban.expires ? yyyy_mm_dd(ban.expires) : ""
			}),
			caption: 'Optionally enter a date upon which the ban expires.  Leave blank for infinite.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_eb_notes',
				rows: 5,
				value: ban.notes
			}),
			caption: 'Optionally enter any notes for the ban, for internal use.'
		});
		
		return html;
	}
	
	get_ban_form_json() {
		// get api key elements from form, used for new or edit
		var ban = this.ban;
		
		ban.email = $('#fe_eb_email').val();
		ban.expires = $('#fe_eb_expires').val();
		ban.notes = $('#fe_eb_notes').val();
		
		if (!ban.email.length) {
			return app.badField('#fe_eb_email', "Please enter an e-mail address for the ban.");
		}
		if (ban.expires) {
			if (!ban.expires.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
				return app.badField('#fe_eb_expires', "Please enter the ban expiration date in YYYY/MM/DD format.");
			}
			ban.expires = get_date_args(ban.expires).epoch;
		} 
		else ban.expires = 0;
		
		return ban;
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
