// Admin Page -- Sorter Config

Page.Sorters = class Sorters extends Page.Base {
	
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
		app.setHeaderTitle( '<i class="mdi mdi-filter">&nbsp;</i>Auto-Sorters' );
		
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show sorter list
		app.setWindowTitle( "Auto-Sorters" );
		
		// use sorters in app cache
		this.receive_sorters({
			code: 0,
			rows: app.sorters,
			list: { length: app.sorters.length }
		});
	}
	
	getNiceSorter(sorter, link) {
		// get formatted sorter with icon, plus optional link
		if (!sorter) return '(None)';
		if (typeof(sorter) == 'string') {
			var sorter_def = find_object( app.sorters, { id: sorter } );
			if (sorter_def) sorter = sorter_def;
			else sorter = { id: sorter };
		}
		
		var html = '';
		var icon = '<i class="mdi mdi-filter">&nbsp;</i>';
		if (link) {
			if (link === true) link = '#Sorters?sub=edit&id=' + sorter.id;
			html += '<a href="' + link + '" style="text-decoration:none">';
			html += icon + '<span style="text-decoration:underline">' + sorter.id + '</span></a>';
		}
		else {
			html += icon + sorter.id;
		}
		
		return html;
	}
	
	receive_sorters(resp) {
		// receive all sorters from server, render them sorted
		var html = '';
		if (!resp.rows) resp.rows = [];
		
		// sort by custom sort order
		this.sorters = resp.rows.sort( function(a, b) {
			return (a.sort_order < b.sort_order) ? -1 : 1;
		} );
		
		var cols = ['<i class="mdi mdi-menu"></i>', 'Sorter ID', 'Search Query', 'Categories', 'Author', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'All Sorters';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var self = this;
		html += this.getBasicTable( this.sorters, cols, 'sorter', function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onMouseUp="$P().edit_sorter('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link" onMouseUp="$P().delete_sorter('+idx+')"><b>Delete</b></span>' );
			
			return [
				'<div class="td_drag_handle" draggable="true" title="Drag to reorder"><i class="mdi mdi-menu"></i></div>',
				'<div class="td_big">' + self.getNiceSorter(item, '#Sorters?sub=edit&id=' + item.id) + '</div>',
				'<div class="">' + item.query + '</div>',
				self.getNiceTagList(item.categories, true),
				self.getNiceUsername(item.username, true),
				// '<span title="' + get_nice_date_time(item.created, true) + '">' + get_nice_date(item.created, true) + '</span>',
				actions.join(' | ')
			];
		} ); // getBasicTable
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button primary" onMouseUp="$P().edit_sorter(-1)">Add Sorter...</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		this.setupDraggableTable({
			table_sel: this.div.find('table.data_table'), 
			handle_sel: 'td div.td_drag_handle', 
			drag_ghost_sel: 'td div.td_big', 
			drag_ghost_x: 5, 
			drag_ghost_y: 10, 
			callback: this.sorter_move.bind(this)
		});
	}
	
	sorter_move($rows) {
		// a drag operation has been completed
		var items = [];
		
		$rows.each( function(idx) {
			var $row = $(this);
			var sorter_id = $row.data('id');
			
			items.push({
				id: sorter_id,
				sort_order: idx
			});
			
			// update client-side cache too
			var sorter = find_object( app.sorters, { id: sorter_id } );
			if (sorter) sorter.sort_order = idx;
		});
		
		var data = {
			items: items
		};
		app.api.post( 'app/multi_update_sorter', data, function(resp) {
			// done
		} );
	}
	
	edit_sorter(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Sorters?sub=edit&id=' + this.sorters[idx].id );
		else Nav.go( '#Sorters?sub=new' );
	}
	
	delete_sorter(idx) {
		// delete sorter from search results
		this.sorter = this.sorters[idx];
		this.show_delete_sorter_dialog();
	}
	
	gosub_new(args) {
		// create new sorter
		var html = '';
		app.setWindowTitle( "New Auto-Sorter" );
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Auto-Sorter';
			html += '<div class="box_subtitle"><a href="#Sorters?sub=list">&laquo; Back to Sorter List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.sorter = {
			id: "",
			query: "",
			categories: [],
			notes: ""
		};
		
		html += this.get_sorter_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_sorter_edit()">Cancel</div>';
			html += '<div class="button primary" onMouseUp="$P().do_new_sorter()"><i class="mdi mdi-floppy">&nbsp;</i>Create Sorter</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		$('#fe_es_query').focus();
		MultiSelect.init( this.div.find('#fe_es_categories') );
	}
	
	cancel_sorter_edit() {
		// cancel editing sorter and return to list
		Nav.go( '#Sorters?sub=list' );
	}
	
	do_new_sorter(force) {
		// create new sorter
		app.clearError();
		var sorter = this.get_sorter_form_json();
		if (!sorter) return; // error
		
		this.sorter = sorter;
		
		Dialog.showProgress( 1.0, "Adding Sorter..." );
		app.api.post( 'app/create_sorter', sorter, this.new_sorter_finish.bind(this) );
	}
	
	new_sorter_finish(resp) {
		// new sorter created successfully
		Dialog.hideProgress();
		
		// refresh client-side sorter list and sidebar
		this.sorter = resp.sorter;
		app.sorters.push( this.sorter );
		
		Nav.go('Sorters?sub=list');
		app.showMessage('success', "The new auto-sorter was created successfully.");
	}
	
	gosub_edit(args) {
		// edit sorter subpage
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		app.api.post( 'app/get_sorter', { id: args.id }, this.receive_sorter.bind(this) );
	}
	
	receive_sorter(resp) {
		// edit existing sorter
		var html = '';
		this.sorter = resp.sorter;
		
		app.setWindowTitle( "Editing Auto-Sorter \"" + (this.sorter.id) + "\"" );
		
		html += '<div class="box">';
			html += '<div class="box_title">';
				html += 'Editing Sorter &ldquo;' + (this.sorter.id) + '&rdquo;';
				html += '<div class="box_subtitle"><a href="#Sorters?sub=list">&laquo; Back to Sorter List</a></div>';
			html += '</div>';
		html += '<div class="box_content">';
		
		// sorter id
		html += this.getFormRow({
			label: 'Sorter ID:',
			content: this.getFormText({
				id: 'fe_es_id',
				class: 'monospace',
				spellcheck: 'false',
				disabled: 'disabled',
				value: this.sorter.id
			}),
			caption: 'A unique ID for the sorter, used internally.  This cannot be changed.'
		});
		
		html += this.get_sorter_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_sorter_edit()">Cancel</div>';
			html += '<div class="button" onMouseUp="$P().show_delete_sorter_dialog()">Delete Sorter...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_save_sorter()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		MultiSelect.init( this.div.find('#fe_es_categories') );
	}
	
	do_save_sorter() {
		// save changes to sorter
		app.clearError();
		var sorter = this.get_sorter_form_json();
		if (!sorter) return; // error
		
		this.sorter = sorter;
		
		Dialog.showProgress( 1.0, "Saving Changes..." );
		app.api.post( 'app/update_sorter', sorter, this.save_sorter_finish.bind(this) );
	}
	
	save_sorter_finish(resp, tx) {
		// new sorter saved successfully
		Dialog.hideProgress();
		
		// refresh client-side sorter list and sidebar
		var sorter = find_object( app.sorters, { id: this.sorter.id } );
		if (sorter) merge_hash_into( sorter, this.sorter );
		
		Nav.go( 'Sorters?sub=list' );
		app.showMessage('success', "The auto-sorter was saved successfully.");
	}
	
	show_delete_sorter_dialog() {
		// show dialog confirming sorter delete action
		var self = this;
		
		Dialog.confirm( '<span style="color:red">Delete Sorter</span>', "Are you sure you want to <b>permanently delete</b> the auto-sorter &ldquo;<b>" + this.sorter.id + "</b>&rdquo;?  There is no way to undo this action.", 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Sorter..." );
				app.api.post( 'app/delete_sorter', self.sorter, self.delete_sorter_finish.bind(self) );
			}
		} );
	}
	
	delete_sorter_finish(resp, tx) {
		// finished deleting sorter
		var self = this;
		Dialog.hideProgress();
		
		// refresh client-side sorter list and sidebar
		var idx = find_object_idx( app.sorters, { id: this.sorter.id } );
		if (idx > -1) app.sorters.splice( idx, 1 );
		
		Nav.go('Sorters?sub=list', 'force');
		app.showMessage('success', "The auto-sorter &ldquo;" + this.sorter.id + "&rdquo; was deleted successfully.");
	}
	
	testSearch() {
		// test search in new tab
		var query = this.div.find('#fe_es_query').val();
		if (!query) return app.badField('#fe_es_query', "Please enter a search query for the sorter.");
		
		if (query.match(/^\(.+\)$/)) {
			// PxQL
			query = '(' + query + ' && type = "topic")';
		}
		else {
			// Simple
			query += ' type:topic';
		}
		
		var url = '#Search?query=' + encodeURIComponent(query);
		window.open( url );
	}
	
	get_sorter_edit_html() {
		// get html for editing an sorter (or creating a new one)
		var html = '';
		var sorter = this.sorter;
		
		// query
		html += this.getFormRow({
			label: 'Search Query:',
			content: this.getFormText({
				id: 'fe_es_query',
				spellcheck: 'false',
				value: sorter.query
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-magnify" title="Test Search..." onMouseUp="$P().testSearch()"></div>',
			caption: 'Enter a search query to match against all new topics.'
		});
		
		// categories
		html += this.getFormRow({
			label: 'Categories:',
			content: this.getFormMenuMulti({
				id: 'fe_es_categories',
				title: 'Select Categories to Apply',
				placeholder: 'Select categories to apply...',
				options: app.tags,
				values: sorter.categories
			}),
			caption: 'Select one or more categories to apply for matched topics.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_es_notes',
				rows: 5,
				value: sorter.notes
			}),
			caption: 'Optionally enter any notes for the sorter, for internal use.'
		});
		
		return html;
	}
	
	get_sorter_form_json() {
		// get api key elements from form, used for new or edit
		var sorter = this.sorter;
		
		sorter.query = $('#fe_es_query').val();
		sorter.categories = $('#fe_es_categories').val();
		sorter.notes = $('#fe_es_notes').val();
		
		if (!sorter.query.length) {
			return app.badField('#fe_es_query', "Please enter a search query for the sorter.");
		}
		if (!sorter.categories.length) {
			return app.badField('#fe_es_categories', "Please select one or more categories to apply.");
		}
		
		return sorter;
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
