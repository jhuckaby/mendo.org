Page.Search = class Search extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		var self = this;
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		
		var preset = args.preset ? find_object( app.user.searches, { name: args.preset } ) : null;
		
		if (preset) {
			// load preset
			for (var key in preset) {
				if (!args[key]) args[key] = preset[key];
			}
			delete args.name;
			delete args.alerts;
			
			// possibly highlight search preset tab
			$('.sidebar .section_item').removeClass('active').addClass('inactive');
			$('#tab_Search_' + args.preset.replace(/\W+/g, '')).removeClass('inactive').addClass('active');
			
			// expand section if applicable
			var $sect = $('#tab_Search_' + args.preset.replace(/\W+/g, '')).parent().prev();
			if ($sect.length && $sect.hasClass('section_title')) app.page_manager.expandSidebarGroup( $sect );
			
			app.setWindowTitle( args.preset );
			app.setHeaderTitle( '<i class="mdi mdi-' + (preset.alerts ? 'bell' : 'magnify') + '">&nbsp;</i>' + args.preset );
		}
		else {
			// default search
			delete args.preset;
			app.setWindowTitle('Search');
			app.setHeaderTitle( '<i class="mdi mdi-cloud-search-outline">&nbsp;</i>Advanced Search' );
		}
		
		// resume if coming back
		var anchor = Nav.currentAnchor();
		if (anchor == this.lastAnchor) {
			$(document).scrollTop( this.lastScrollY );
			return true;
		}
		this.lastAnchor = anchor;
		
		var html = '';
		html += '<div class="box" style="border:none;">';
		html += '<div class="box_content" style="padding:20px;">';
			
			// search box
			html += '<div class="search_box">';
				html += '<i class="mdi mdi-magnify">&nbsp;</i><input type="text" id="fe_s_query" maxlength="128" placeholder="Enter search query..." value="' + escape_text_field_value(args.query || '') + '">';
			html += '</div>';
			
			// options
			html += '<div class="form_grid" style="margin-bottom:25px">';
			
				html += '<div class="form_cell">';
					// tags
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-tag-multiple">&nbsp;</i>Categories:',
						content: this.getFormMenuMulti({
							id: 'fe_s_cats',
							title: 'Select Categories',
							placeholder: 'All Categories',
							options: app.tags,
							values: args.tags ? args.tags.split(/\,\s*/) : [],
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				html += '<div class="form_cell">';
					// locations
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-map-marker-multiple">&nbsp;</i>Locations:',
						content: this.getFormMenuMulti({
							id: 'fe_s_locs',
							title: 'Select Locations',
							placeholder: 'All Locations',
							options: app.locations,
							values: args.locations ? args.locations.split(/\,\s*/) : [],
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				html += '<div class="form_cell">';
					// date range
					var date_items = [
						['', 'All Dates'],
						['today', 'Today'],
						['yesterday', 'Yesterday'],
						['month', 'This Month'],
						['lastmonth', 'Last Month'],
						['year', 'This Year'],
						['lastyear', 'Last Year']
					];
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-calendar-multiple">&nbsp;</i>Date Range:',
						content: this.getFormMenuSingle({
							id: 'fe_s_date',
							title: 'Date Range',
							options: date_items,
							value: args.date,
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
				html += '<div class="form_cell">';
					// sort
					var sort_items = [
						['date_desc', 'Newest'],
						['date_asc', 'Oldest'],
						['replies_desc', 'Popularity']
					];
					html += this.getFormRow({
						label: '<i class="icon mdi mdi-sort">&nbsp;</i>Sort Results:',
						content: this.getFormMenuSingle({
							id: 'fe_s_sort',
							title: 'Sort Results',
							options: sort_items,
							value: args.sort,
							'data-shrinkwrap': 1
						})
					});
				html += '</div>';
				
			html += '</div>'; // form_grid
		
		// buttons at bottom
		html += '<div class="box_buttons" style="padding:0">';
			if (preset) {
				html += '<div class="button mobile_collapse" onMouseUp="$P().doDeletePreset()"><i class="mdi mdi-trash-can-outline">&nbsp;</i><span>Delete Preset...</span></div>';
			}
			html += '<div class="button mobile_collapse" onMouseUp="$P().doSavePreset()"><i class="mdi mdi-floppy">&nbsp;</i><span>' + (preset ? 'Edit' : 'Save') + ' Preset...</span></div>';
			html += '<div class="button" id="btn_s_download" onMouseUp="$P().doDownload()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i>Download All...</div>';
			html += '<div class="button primary" onMouseUp="$P().navSearch()"><i class="mdi mdi-magnify">&nbsp;</i>Search</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		html += '<div id="d_search_results"><div class="loading_container"><div class="loading"></div></div></div>';
		
		this.div.html( html );
		
		MultiSelect.init( this.div.find('#fe_s_cats, #fe_s_locs') );
		SingleSelect.init( this.div.find('#fe_s_date, #fe_s_sort') );
		// $('.header_search_widget').hide();
		
		$('#fe_s_query').on('keydown', function(event) {
			// capture enter key
			if ((event.keyCode == 13) && this.value.length) {
				event.preventDefault();
				self.navSearch();
			}
		});
		
		if (args.query || args.tags || args.locations || args.date) {
			this.doSearch();
		}
		else {
			$('#fe_s_query').focus();
			app.api.get( 'app/doc', { id: 'search' }, this.receiveHelp.bind(this) );
		}
		
		return true;
	}
	
	receiveHelp(resp) {
		// show search help (markdown)
		var html = '';
		
		html += '<div class="box">';
		html += '<div class="box_content">';
		html += '<div class="markdown-body code" style="' + this.getUserFontStyle() + '">';
		
		html += marked(resp.data, {
			gfm: true,
			tables: true,
			breaks: false,
			pedantic: false,
			sanitize: false,
			smartLists: true,
			smartypants: false,
			silent: true,
			headerIds: false,
			mangle: false
		});
		
		html += '</div>'; // markdown-body
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.find('#d_search_results').html(html);
	}
	
	getSearchArgs() {
		// get form values, return search args object
		var args = {
			query: this.div.find('#fe_s_query').val().trim()
		};
		
		var cats = this.div.find('#fe_s_cats').val();
		if (cats.length) args.tags = cats.join(',');
		
		var locs = this.div.find('#fe_s_locs').val();
		if (locs.length) args.locations = locs.join(',');
		
		var date = this.div.find('#fe_s_date').val();
		if (date) args.date = date;
		
		var sort = this.div.find('#fe_s_sort').val();
		if (sort != 'date_desc') args.sort = sort;
		
		if (!args.query && !args.tags && !args.locations && !args.date) return null;
		
		return args;
	}
	
	navSearch() {
		// convert form into query and redirect
		app.clearError();
		
		var args = this.getSearchArgs();
		if (!args) return app.badField('#fe_s_query', "Please enter a search query.");
		
		// save editing state across searches
		if (this.args.preset) args.preset = this.args.preset;
		
		Nav.go( this.selfNav(args) );
	}
	
	getSearchQuery(args) {
		// construct actual unbase simple query syntax
		var query = args.query.toLowerCase().trim();
		if (args.tags) query += ' tags:' + args.tags.split(/\,\s*/).join('|');
		if (args.locations) query += ' locations:' + args.locations.split(/\,\s*/).join('|');
		
		if (args.date) {
			switch (args.date) {
				case 'today': 
					query += ' date:today'; 
				break;
				case 'yesterday': 
					query += ' date:yesterday'; 
				break;
				case 'month': 
					var dargs = get_date_args( time_now() );
					query += ' date:' + dargs.yyyy_mm; 
				break;
				case 'lastmonth':
					var dargs = get_date_args( normalize_time( time_now(), { mday:1, hour:0, min:0, sec:0 } ) - 43200 );
					query += ' date:' + dargs.yyyy_mm; 
				break;
				case 'year': 
					var dargs = get_date_args( time_now() );
					query += ' date:' + dargs.yyyy; 
				break;
				case 'lastyear':
					var dargs = get_date_args( normalize_time( time_now(), { mon:1, mday:1, hour:0, min:0, sec:0 } ) - 43200 );
					query += ' date:' + dargs.yyyy; 
				break;
			}
		}
		
		return query.trim();
	}
	
	doSearch() {
		// actually perform the search
		var args = this.args;
		var query = this.getSearchQuery(args);
		
		// compose search query
		this.records = [];
		this.opts = {
			query: query.trim(),
			offset: args.offset || 0,
			limit: config.items_per_page
		};
		switch (args.sort) {
			case 'date_asc':
				this.opts.sort_by = '_id'; 
				this.opts.sort_dir = 1;
			break;
			
			case 'replies_desc':
				this.opts.sort_by = 'replies'; 
				this.opts.sort_dir = -1;
			break;
		} // sort
		
		app.api.get( 'app/search', this.opts, this.receiveResults.bind(this) );
	}
	
	receiveResults(resp) {
		// receive search results
		var self = this;
		var html = '';
		var preamble = '';
		var num_hidden = 0;
		var $results = this.div.find('#d_search_results');
		
		$results.find('.loading_container').remove();
		$results.find('.load_more').remove();
		
		if (resp.total) {
			resp.records.forEach( function(record) {
				if (!self.userFilterRecord(record)) { num_hidden++; return; }
				
				var idx = self.records.length;
				self.prepDisplayRecord(record, idx);
				self.records.push(record);
				
				html += '<div class="message_container" data-idx="' + idx + '">';
					html += '<div class="box ' + (record.boxClass || '') + '">';
						html += '<div class="box_title subject"><a href="#View?id=' + (record.parent || record.id) + '">' + record.disp.subject + '</a>';
							html += record.disp.admin;
							html += '<div>';
								html += '<div class="box_subtitle from">' + record.disp.from + '</div>';
								html += '<div class="box_subtitle date">' + record.disp.date + '</div>';
							html += '</div>';
						html += '</div>';
						html += '<div class="message_body">' + record.disp.body + '</div>';
						if (record.type == 'topic') {
							html += '<div class="message_footer">' + record.disp.foot_widgets.join('') + '<div class="clear"></div>' + '</div>';
						}
						else {
							html += '<div class="message_footer" style="height:0"></div>';
						}
					html += '</div>'; // box
				html += '</div>'; // message_container
			}); // forEach
		} // resp.total
		
		if (this.records.length) {
			if (!this.opts.offset) {
				preamble += '<div class="search_total">Found ' + commify(resp.total) + ' total ' + pluralize('result', resp.total);
				if (num_hidden) preamble += ' (' + num_hidden + ' hidden)';
				preamble += '</div>';
			}
		}
		else {
			html += '<div class="box"><div class="box_content"><div class="inline_page_message">No results matched your search query.</div></div></div>';
		}
		if (resp.total && (this.opts.offset + resp.records.length < resp.total)) {
			html += '<div class="load_more"><div class="button center" onMouseUp="$P().loadMoreResults()"><i class="mdi mdi-arrow-down-circle-outline">&nbsp;</i>Load More...</div></div>';
		}
		
		$results.append( preamble + html );
		this.expandInlineImages();
		this.onScrollDebounce();
	}
	
	onScrollDebounce() {
		// look for visible dirty ML suggestion widgets, and populate them
		this.updateSuggestions();
	}
	
	refresh() {
		// refresh search results from the top
		this.div.find('#d_search_results').html( '<div class="loading_container"><div class="loading"></div></div>' );
		this.opts.offset = 0;
		app.api.get( 'app/search', this.opts, this.receiveResults.bind(this) );
	}
	
	loadMoreResults() {
		// load more search results, append to list
		this.div.find('.load_more').html( '<div class="loading"></div>' );
		this.opts.offset += config.items_per_page;
		app.api.get( 'app/search', this.opts, this.receiveResults.bind(this) );
	}
	
	doSavePreset() {
		// save search preset
		var self = this;
		app.clearError();
		
		var sargs = this.getSearchArgs();
		if (!sargs) return app.badField('#fe_s_query', "Please enter a search query before saving a preset.");
		
		var preset = {};
		if (this.args.preset) {
			preset = find_object( app.user.searches, { name: this.args.preset } ) || {};
		}
		
		var html = '';
		html += '<div class="box_content" style="padding-bottom:15px;">';
		
		html += this.getFormRow({
			label: 'Preset Name:',
			content: this.getFormText({
				id: 'fe_sp_name',
				spellcheck: 'false',
				maxlength: 64,
				disabled: !!preset.name,
				value: preset.name || ''
			}),
			caption: preset.name ? 'You are editing an existing search preset.' : 'Enter a title for your search preset (this will show in the sidebar).'
		});
		
		html += this.getFormRow({
			label: 'Alerts:',
			content: this.getFormCheckbox({
				id: 'fe_sp_alert',
				checked: !!preset.alerts,
				label: "Notify me for new messages"
			}),
			caption: 'When checked, we will e-mail you all new messages that match your search query.'
		});
		
		html += '</div>';
		Dialog.confirm( preset.name ? 'Edit Search Preset' : 'Save Search Preset', html, preset.name ? 'Save Changes' : 'Save Preset', function(result) {
			if (!result) return;
			
			preset = sargs;
			preset.name = $('#fe_sp_name').val().trim();
			preset.alerts = !!$('#fe_sp_alert').is(':checked');
			
			if (!preset.name) return app.badField('#fe_sp_name', "Please enter a name for the search preset before saving.");
			
			var idx = find_object_idx(app.user.searches, { name: preset.name });
			if (idx > -1) {
				// replace
				app.user.searches[idx] = preset;
			}
			else {
				// add new
				app.user.searches.push( preset );
			}
			
			Dialog.showProgress( 1.0, "Saving preset..." );
			
			app.api.post( 'app/user_settings', {
				searches: app.user.searches
			}, 
			function(resp) {
				// save complete
				Dialog.hideProgress();
				app.showMessage('success', "Your search preset was saved successfully.");
				app.initSidebarTabs();
				Nav.go( self.selfNav({ preset: preset.name }), true );
			} ); // api resp
		} ); // Dialog.confirm
		
		$('#fe_sp_name').focus();
	}
	
	doDeletePreset() {
		// delete search preset, after confirmation
		var self = this;
		var preset_idx = find_object_idx( app.user.searches, { name: this.args.preset } );
		if (preset_idx == -1) return; // sanity
		var preset = app.user.searches[preset_idx];
		
		var msg = "Are you sure you want to delete the search preset &ldquo;<b>" + encode_entities(preset.name) + "</b>&rdquo;?  You cannot undo this action.";
		
		Dialog.confirm( '<span style="color:red">Delete Search Preset</span>', msg, 'Delete Preset', function(result) {
			if (result) {
				app.user.searches.splice( preset_idx, 1 );
				Dialog.showProgress( 1.0, "Saving settings..." );
				
				app.api.post( 'app/user_settings', {
					searches: app.user.searches
				}, 
				function(resp) {
					// save complete
					Dialog.hideProgress();
					app.showMessage('success', "Your search preset was successfully deleted.");
					app.initSidebarTabs();
					Nav.go('Search');
				} ); // api resp
			} // confirmed
		} ); // Dialog.confirm
	}
	
	doDownload() {
		// download all results as a Mbox archive
		var sargs = this.getSearchArgs();
		if (!sargs) return app.badField('#fe_s_query', "Please enter a search query before trying to download.");
		
		var squery = this.getSearchQuery(sargs);
		squery = this.userFilterSearchQuery(squery);
		
		// determine a nice default filename
		var filename = '';
		if (this.args.preset) filename = this.args.preset.replace(/\W+/g, '-');
		else if (sargs.query) filename = sargs.query.replace(/\W+/g, '-');
		else if (sargs.tags) filename = sargs.tags.replace(/\W+/g, '-');
		else if (sargs.locations) filename = sargs.locations.replace(/\W+/g, '-');
		else if (sargs.date) filename = sargs.date.replace(/\W+/g, '-');
		else filename = 'search-results';
		if (filename.length > 26) filename = filename.substring(0, 26);
		filename = filename.replace(/\-$/, '');
		filename += '.mbox';
		
		var html = '';
		html += '<div class="dialog_help" style="margin-bottom:0">Use this feature to download an <a href="https://en.wikipedia.org/wiki/Mbox" target="_blank">Mbox archive</a> of all the search results.  You can then import the Mbox archive into your favorite e-mail application.</div>';
		html += '<div class="box_content" style="padding-bottom:15px;">';
		
		html += this.getFormRow({
			label: 'Filename:',
			content: this.getFormText({
				id: 'fe_mbox_filename',
				spellcheck: 'false',
				maxlength: 64,
				value: filename
			}),
			caption: 'Enter a filename for your Mbox archive.'
		});
		
		html += '</div>';
		Dialog.confirm( 'Download All', html, 'Download', function(result) {
			if (!result) return;
			filename = $('#fe_mbox_filename').val().trim().replace(/[^\w\-\.]+/g, '-');
			if (!filename || !filename.match(/\w/)) return app.badField('#fe_mbox_filename', "Please enter a valid filename for your Mbox archive.");
			if (!filename.match(/\.mbox$/i)) filename += '.mbox';
			Dialog.showProgress( 1.0, "Preparing download..." );
			
			// get download token first
			// (so we don't have to add the session ID onto the URL)
			app.api.post( 'app/get_download_token', {}, function(resp) {
				// got token
				var url = '/api/app/download_mbox' + compose_query_string({
					token: resp.token,
					username: app.username,
					query: squery,
					filename: filename
				});
				window.location = url;
				
				setTimeout( function() {
					Dialog.hideProgress();
					app.showMessage('success', "Your download should begin momentarily.");
				}, 50 );
			} ); // api resp
		} ); // Dialog.confirm
		
		// pre-select the filename sans extension
		$('#fe_mbox_filename').focus().get(0).setSelectionRange(0, filename.length - 5);
	}
	
	onDeactivate() {
		// called when page is deactivated
		// this.div.html( '' );
		this.lastScrollY = $(document).scrollTop();
		// $('.header_search_widget').show();
		return true;
	}
	
};
