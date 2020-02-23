// Admin Page -- Tag Config

Page.Tags = class Tags extends Page.Base {
	
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
		app.setHeaderTitle( '<i class="mdi mdi-tag-multiple">&nbsp;</i>Category Setup' );
		
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		this['gosub_'+args.sub](args);
		
		return true;
	}
	
	gosub_list(args) {
		// show tag list
		app.setWindowTitle( "Categories" );
		
		// use tags in app cache
		this.receive_tags({
			code: 0,
			rows: app.tags,
			list: { length: app.tags.length }
		});
	}
	
	receive_tags(resp) {
		// receive all tags from server, render them sorted
		var html = '';
		if (!resp.rows) resp.rows = [];
		
		// sort by custom sort order
		this.tags = resp.rows.sort( function(a, b) {
			return a.id.localeCompare( b.id );
		} );
		
		var cols = ['Category', 'ID', 'Author', 'Created', 'Modified', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'All Categories';
		html += '</div>';
		html += '<div class="box_content table">';
		
		var self = this;
		html += this.getBasicTable( this.tags, cols, 'category', function(item, idx) {
			var actions = [];
			actions.push( '<span class="link" onMouseUp="$P().edit_tag('+idx+')"><b>Edit</b></span>' );
			actions.push( '<span class="link" onMouseUp="$P().delete_tag('+idx+')"><b>Delete</b></span>' );
			
			return [
				'<div class="td_big">' + self.getNiceTag(item, '#Tags?sub=edit&id=' + item.id) + '</div>',
				'<div class="mono">' + item.id + '</div>',
				self.getNiceUsername(item.username, true),
				'<span title="' + get_nice_date_time(item.created, true) + '">' + get_nice_date(item.created, true) + '</span>',
				'<span title="' + get_nice_date_time(item.modified, true) + '">' + get_nice_date(item.modified, true) + '</span>',
				actions.join(' | ')
			];
		} ); // getBasicTable
		
		html += '</div>'; // box_content
		
		html += '<div class="box_buttons">';
			html += '<div class="button primary" onMouseUp="$P().edit_tag(-1)">Add Category...</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
	}
	
	edit_tag(idx) {
		// jump to edit sub
		if (idx > -1) Nav.go( '#Tags?sub=edit&id=' + this.tags[idx].id );
		else Nav.go( '#Tags?sub=new' );
	}
	
	delete_tag(idx) {
		// delete tag from search results
		this.tag = this.tags[idx];
		this.show_delete_tag_dialog();
	}
	
	gosub_new(args) {
		// create new tag
		var html = '';
		app.setWindowTitle( "New Category" );
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'New Category';
			html += '<div class="box_subtitle"><a href="#Tags?sub=list">&laquo; Back to Category List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		this.tag = {
			id: "",
			title: "",
			icon: "mdi-tag"
		};
		
		html += this.get_tag_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_tag_edit()">Cancel</div>';
			html += '<div class="button primary" onMouseUp="$P().do_new_tag()"><i class="mdi mdi-floppy">&nbsp;</i>Create</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		$('#fe_et_id').focus();
	}
	
	cancel_tag_edit() {
		// cancel editing tag and return to list
		Nav.go( '#Tags?sub=list' );
	}
	
	do_new_tag(force) {
		// create new tag
		app.clearError();
		var tag = this.get_tag_form_json();
		if (!tag) return; // error
		
		this.tag = tag;
		
		Dialog.showProgress( 1.0, "Creating Category..." );
		app.api.post( 'app/create_tag', tag, this.new_tag_finish.bind(this) );
	}
	
	new_tag_finish(resp) {
		// new tag created successfully
		Dialog.hideProgress();
		
		// refresh client-side tag list and sidebar
		this.tag.username = app.username;
		this.tag.created = this.tag.modified = time_now();
		app.tags.push( this.tag );
		app.initSidebarTabs();
		
		Nav.go('Tags?sub=list');
		app.showMessage('success', "The new category was created successfully.");
	}
	
	gosub_edit(args) {
		// edit tag subpage
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		app.api.post( 'app/get_tag', { id: args.id }, this.receive_tag.bind(this) );
	}
	
	receive_tag(resp) {
		// edit existing tag
		var html = '';
		this.tag = resp.tag;
		
		app.setWindowTitle( "Editing Category \"" + (this.tag.title) + "\"" );
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'Editing Category &ldquo;' + (this.tag.title) + '&rdquo;';
			html += '<div class="box_subtitle"><a href="#Tags?sub=list">&laquo; Back to Category List</a></div>';
		html += '</div>';
		html += '<div class="box_content">';
		
		html += this.get_tag_edit_html();
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button" onMouseUp="$P().cancel_tag_edit()">Cancel</div>';
			html += '<div class="button" onMouseUp="$P().show_delete_tag_dialog()">Delete...</div>';
			html += '<div class="button primary" onMouseUp="$P().do_save_tag()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
		
		this.div.html( html );
		
		// lock ID for editing
		$('#fe_et_id').attr('disabled', true);
	}
	
	do_save_tag() {
		// save changes to tag
		app.clearError();
		var tag = this.get_tag_form_json();
		if (!tag) return; // error
		
		this.tag = tag;
		
		Dialog.showProgress( 1.0, "Saving Category..." );
		app.api.post( 'app/update_tag', tag, this.save_tag_finish.bind(this) );
	}
	
	save_tag_finish(resp, tx) {
		// new tag saved successfully
		Dialog.hideProgress();
		
		// refresh client-side tag list and sidebar
		var tag = find_object( app.tags, { id: this.tag.id } );
		if (tag) merge_hash_into( tag, this.tag );
		app.initSidebarTabs();
		
		Nav.go( 'Tags?sub=list' );
		app.showMessage('success', "The category was saved successfully.");
	}
	
	show_delete_tag_dialog() {
		// show dialog confirming tag delete action
		var self = this;
		if (app.tags.length < 2) return app.doError("Sorry, you cannot delete the last category.");
		
		Dialog.confirm( '<span style="color:red">Delete Category</span>', "Are you sure you want to <b>permanently delete</b> the category &ldquo;" + this.tag.title + "&rdquo;?  There is no way to undo this action.", 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting Category..." );
				app.api.post( 'app/delete_tag', self.tag, self.delete_tag_finish.bind(self) );
			}
		} );
	}
	
	delete_tag_finish(resp, tx) {
		// finished deleting tag
		var self = this;
		Dialog.hideProgress();
		
		// refresh client-side tag list and sidebar
		var idx = find_object_idx( app.tags, { id: this.tag.id } );
		if (idx > -1) app.tags.splice( idx, 1 );
		app.initSidebarTabs();
		
		Nav.go('Tags?sub=list', 'force');
		app.showMessage('success', "The category &ldquo;" + this.tag.title + "&rdquo; was deleted successfully.");
	}
	
	get_tag_edit_html() {
		// get html for editing an tag (or creating a new one)
		var html = '';
		var tag = this.tag;
		
		// tag id
		html += this.getFormRow({
			label: 'Category ID:',
			content: this.getFormText({
				id: 'fe_et_id',
				class: 'monospace',
				spellcheck: 'false',
				onChange: '$P().checkTagExists(this)',
				value: tag.id
			}),
			suffix: '<div class="checker"></div>',
			caption: 'Enter a unique ID for the category (alphanumerics only).  Once created this cannot be changed.'
		});
		
		// title
		html += this.getFormRow({
			label: 'Category Title:',
			content: this.getFormText({
				id: 'fe_et_title',
				spellcheck: 'false',
				value: tag.title
			}),
			caption: 'Enter the title (label) for the category, for display purposes.'
		});
		
		// icon
		html += this.getFormRow({
			label: 'Category Icon:',
			content: this.getFormText({
				id: 'fe_et_icon',
				spellcheck: 'false',
				onChange: '$P().updateIcon(this)',
				value: tag.icon
			}),
			suffix: '<div class="checker"><span class="mdi mdi-' + tag.icon + '"></span></div>',
			caption: 'Optionally enter an icon ID to display next to the category.  Select any from <a href="https://cdn.materialdesignicons.com/4.5.95/" target="_blank">this list</a>.'
		});
		
		// notes
		html += this.getFormRow({
			label: 'Notes:',
			content: this.getFormTextarea({
				id: 'fe_et_notes',
				rows: 5,
				value: tag.notes
			}),
			caption: 'Optionally enter any notes for the category, for internal use.'
		});
		
		return html;
	}
	
	get_tag_form_json() {
		// get api key elements from form, used for new or edit
		var tag = this.tag;
		
		tag.id = $('#fe_et_id').val().replace(/\W+/g, '').toLowerCase();
		tag.title = $('#fe_et_title').val();
		tag.icon = $('#fe_et_icon').val();
		tag.notes = $('#fe_et_notes').val();
		
		if (!tag.id.length) {
			return app.badField('#fe_et_id', "Please enter a unique alphanumeric ID for the category.");
		}
		if (!tag.title.length) {
			return app.badField('#fe_et_title', "Please enter a title for the category.");
		}
		
		return tag;
	}
	
	updateIcon(field) {
		// render icon next to text field
		var $field = $(field);
		var icon = trim( $field.val().toLowerCase() );
		var $elem = $field.closest('.form_row').find('.fr_suffix .checker');
		$elem.html('<span class="mdi mdi-' + icon + '"></span>');
	}
	
	checkTagExists(field) {
		// check if tag exists, update UI checkbox
		// called after field changes
		var $field = $(field);
		var id = trim( $field.val().toLowerCase() );
		var $elem = $field.closest('.form_row').find('.fr_suffix .checker');
		
		if (id.match(/^\w+$/)) {
			// check with cache
			if (find_object(app.tags, { id: id })) {
				// tag taken
				$elem.css('color','red').html('<span class="mdi mdi-alert-circle"></span>').attr('title', "Category ID is taken.");
				$field.addClass('warning');
			}
			else {
				// tag is valid and available!
				$elem.css('color','green').html('<span class="mdi mdi-check-circle"></span>').attr('title', "Category ID is available!");
				$field.removeClass('warning');
			}
		}
		else if (id.length) {
			// bad id
			$elem.css('color','red').html('<span class="mdi mdi-alert-decagram"></span>').attr('title', "Category ID is malformed.");
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
