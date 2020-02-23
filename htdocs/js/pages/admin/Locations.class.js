// Admin Page -- Location Config

Page.Locations = class Locations extends Page.Base {
	
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
		app.setHeaderTitle( '<i class="mdi mdi-map-marker-multiple">&nbsp;</i>Location Setup' );
		
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show location list
		app.setWindowTitle( "Locations" );
		
		// use locations in app cache
		this.receive_locations({
			code: 0,
			rows: app.locations,
			list: { length: app.locations.length }
		});
	}
	
	receive_locations(resp) {
		// receive all locations from server, render them sorted
		var html = '';
		if (!resp.rows) resp.rows = [];
		
		// sort by custom sort order
		this.locations = resp.rows.sort( function(a, b) {
			return a.id.localeCompare( b.id );
		} );
		
		var cols = ['Location', 'ID', 'Author', 'Created', 'Modified', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'All Locations';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var self = this;
		html += this.getBasicTable( this.locations, cols, 'location', function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onMouseUp="$P().edit_location('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link" onMouseUp="$P().delete_location('+idx+')"><b>Delete</b></span>' );
			
			return [
				'<div class="td_big">' + self.getNiceLocation(item, '#Locations?sub=edit&id=' + item.id) + '</div>',
				'<div class="mono">' + item.id + '</div>',
				self.getNiceUsername(item.username, true),
				'<span title="' + get_nice_date_time(item.created, true) + '">' + get_nice_date(item.created, true) + '</span>',
				'<span title="' + get_nice_date_time(item.modified, true) + '">' + get_nice_date(item.modified, true) + '</span>',
				actions.join(' | ')
			];
		} ); // getBasicTable
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button primary" onMouseUp="$P().edit_location(-1)">Add Location...</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
	}
	
	edit_location(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Locations?sub=edit&id=' + this.locations[idx].id );
		else Nav.go( '#Locations?sub=new' );
	}
	
	delete_location(idx) {
		// delete location from search results
		this.location = this.locations[idx];
		this.show_delete_location_dialog();
	}
	
	gosub_new(args) {
		// create new location
		var html = '';
		app.setWindowTitle( "New Location" );
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Location';
			html += '<div class="box_subtitle"><a href="#Locations?sub=list">&laquo; Back to Location List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.location = {
			id: "",
			title: ""
		};
		
		html += this.get_location_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_location_edit()">Cancel</div>';
			html += '<div class="button primary" onMouseUp="$P().do_new_location()"><i class="mdi mdi-floppy">&nbsp;</i>Create Location</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		$('#fe_et_id').focus();
	}
	
	cancel_location_edit() {
		// cancel editing location and return to list
		Nav.go( '#Locations?sub=list' );
	}
	
	do_new_location(force) {
		// create new location
		app.clearError();
		var location = this.get_location_form_json();
		if (!location) return; // error
		
		this.location = location;
		
		Dialog.showProgress( 1.0, "Creating Location..." );
		app.api.post( 'app/create_location', location, this.new_location_finish.bind(this) );
	}
	
	new_location_finish(resp) {
		// new location created successfully
		Dialog.hideProgress();
		
		// refresh client-side loc list and sidebar
		this.location.username = app.username;
		this.location.created = this.location.modified = time_now();
		app.locations.push( this.location );
		app.initSidebarTabs();
		
		Nav.go('Locations?sub=list');
		app.showMessage('success', "The new location was created successfully.");
	}
	
	gosub_edit(args) {
		// edit location subpage
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		app.api.post( 'app/get_location', { id: args.id }, this.receive_location.bind(this) );
	}
	
	receive_location(resp) {
		// edit existing location
		var html = '';
		this.location = resp.location;
		
		app.setWindowTitle( "Editing Location \"" + (this.location.title) + "\"" );
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Editing Location &ldquo;' + (this.location.title) + '&rdquo;';
				html += '<div class="box_subtitle"><a href="#Locations?sub=list">&laquo; Back to Location List</a></div>';
			html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_location_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_location_edit()">Cancel</div>';
			html += '<div class="button" onMouseUp="$P().show_delete_location_dialog()">Delete Location...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_save_location()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// lock ID for editing
		$('#fe_et_id').attr('disabled', true);
	}
	
	do_save_location() {
		// save changes to location
		app.clearError();
		var location = this.get_location_form_json();
		if (!location) return; // error
		
		this.location = location;
		
		Dialog.showProgress( 1.0, "Saving Location..." );
		app.api.post( 'app/update_location', location, this.save_location_finish.bind(this) );
	}
	
	save_location_finish(resp, tx) {
		// new location saved successfully
		Dialog.hideProgress();
		
		// refresh client-side loc list and sidebar
		var loc = find_object( app.locations, { id: this.location.id } );
		if (loc) merge_hash_into( loc, this.location );
		app.initSidebarTabs();
		
		Nav.go( 'Locations?sub=list' );
		app.showMessage('success', "The location was saved successfully.");
	}
	
	show_delete_location_dialog() {
		// show dialog confirming location delete action
		var self = this;
		if (app.locations.length < 2) return app.doError("Sorry, you cannot delete the last location.");
		
		Dialog.confirm( '<span style="color:red">Delete Location</span>', "Are you sure you want to <b>permanently delete</b> the location &ldquo;" + this.location.title + "&rdquo;?  There is no way to undo this action.", 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Location..." );
				app.api.post( 'app/delete_location', self.location, self.delete_location_finish.bind(self) );
			}
		} );
	}
	
	delete_location_finish(resp, tx) {
		// finished deleting location
		var self = this;
		Dialog.hideProgress();
		
		// refresh client-side loc list and sidebar
		var idx = find_object_idx( app.locations, { id: this.location.id } );
		if (idx > -1) app.locations.splice( idx, 1 );
		app.initSidebarTabs();
		
		Nav.go('Locations?sub=list', 'force');
		app.showMessage('success', "The location &ldquo;" + this.location.title + "&rdquo; was deleted successfully.");
	}
	
	get_location_edit_html() {
		// get html for editing an location (or creating a new one)
		var html = '';
		var location = this.location;
		
		// location id
		html += this.getFormRow({
			label: 'Location ID:',
			content: this.getFormText({
				id: 'fe_et_id',
				class: 'monospace',
				spellcheck: 'false',
				onChange: '$P().checkLocationExists(this)',
				value: location.id
			}),
			suffix: '<div class="checker"></div>',
			caption: 'Enter a unique ID for the location (alphanumerics only).  Once created this cannot be changed.'
		});
		
		// title
		html += this.getFormRow({
			label: 'Location Title:',
			content: this.getFormText({
				id: 'fe_et_title',
				spellcheck: 'false',
				value: location.title
			}),
			caption: 'Enter the title (label) for the location, for display purposes.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_et_notes',
				rows: 5,
				value: location.notes
			}),
			caption: 'Optionally enter any notes for the location, for internal use.'
		});
		
		return html;
	}
	
	get_location_form_json() {
		// get api key elements from form, used for new or edit
		var location = this.location;
		
		location.id = $('#fe_et_id').val().replace(/\W+/g, '').toLowerCase();
		location.title = $('#fe_et_title').val();
		location.notes = $('#fe_et_notes').val();
		
		if (!location.id.length) {
			return app.badField('#fe_et_id', "Please enter a unique alphanumeric ID for the location.");
		}
		if (!location.title.length) {
			return app.badField('#fe_et_title', "Please enter a title for the location.");
		}
		
		return location;
	}
	
	checkLocationExists(field) {
		// check if location exists, update UI checkbox
		// called after field changes
		var $field = $(field);
		var id = trim( $field.val().toLowerCase() );
		var $elem = $field.closest('.form_row').find('.fr_suffix .checker');
		
		if (id.match(/^\w+$/)) {
			// check with cache
			if (find_object(app.locations, { id: id })) {
				// location taken
				$elem.css('color','red').html('<span class="mdi mdi-alert-circle"></span>').attr('title', "Location ID is taken.");
				$field.addClass('warning');
			}
			else {
				// location is valid and available!
				$elem.css('color','green').html('<span class="mdi mdi-check-circle"></span>').attr('title', "Location ID is available!");
				$field.removeClass('warning');
			}
		}
		else if (id.length) {
			// bad id
			$elem.css('color','red').html('<span class="mdi mdi-alert-decagram"></span>').attr('title', "Location ID is malformed.");
			$field.addClass('warning');
		}
		else {
			// empty
			$elem.html('').removeAttr('title');
			$field.removeClass('warning');
		}
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
