Page.Tag = class PageTag extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		this.tag = find_object( app.tags, { id: args.id || '_NOPE_' } );
		if (!this.tag) {
			app.setWindowTitle('Category View');
			app.setHeaderTitle( '<i class="mdi mdi-tag-multiple">&nbsp;</i>Category View' );
			app.showSidebar(true);
			this.doFullPageError('The Category ID was not found.');
			return true;
		}
		var tag = this.tag;
		
		app.setWindowTitle( tag.title );
		app.setHeaderTitle( '<i class="mdi mdi-' + (tag.icon || 'tag') + '">&nbsp;</i>' + tag.title );
		app.showSidebar(true);
		
		// highlight custom sidebar tab for tag
		$('.sidebar .section_item').removeClass('active').addClass('inactive');
		$('#tab_Tag_' + tag.id).removeClass('inactive').addClass('active');
		
		// expand section if applicable
		var $sect = $('#tab_Tag_' + tag.id).parent().prev();
		if ($sect.length && $sect.hasClass('section_title')) app.page_manager.expandSidebarGroup( $sect );
		
		// customize quick search for this page
		$('#fe_header_search').attr('placeholder', 'Search ' + tag.title + '...');
		
		// resume if coming back
		var anchor = Nav.currentAnchor();
		if (anchor == this.lastAnchor) {
			$(document).scrollTop( this.lastScrollY );
			return true;
		}
		this.lastAnchor = anchor;
		
		var html = '';
		
		// see if entire tag is filtered
		if (app.user.exclude_tags.includes(tag.id) && !("filter" in args) && app.user.enable_filters) {
			html += '<div style="height:60px;"></div>';
			
			html += '<div class="box">';
				html += '<div class="box_title error">Category Filtered</div>';
				html += '<div class="box_content">This category is filtered out in your user settings, meaning you will never see any topics tagged <b>' + this.getNiceTag(tag.id) + '</b>.  You can manage your filters and change this setting on the <b><a href="#MySettings">Preferences</a></b> screen.<br/><br/><a href="#Tag?id=' + tag.id + '&filter=0"><i class="mdi mdi-arrow-down-circle-outline">&nbsp;</i>Temporarily disable my filters here</a></div>';
			html += '</div>';
			
			html += '<div style="height:60px;"></div>';
			this.div.html( html );
			return true;
		}
		if (("filter" in this.args) && (this.args.filter == 0)) {
			html += '<div class="box" style="border:none;">';
				// html += '<div class="box_title" style="padding-bottom:0">Filters Disabled</div>';
				html += '<div class="box_content"><b><i class="mdi mdi-information-outline">&nbsp;</i>Notice:</b> Your filters have been temporarily disabled on this page.  The topics shown here would normally be hidden from your view.</div>';
			html += '</div>';
		}
		
		html += this.getMiniPageHeader({
			// title: 'All Topics',
			subtitle: tag.notes || 'All topics for category, newest on top.'
		});
		
		/* if (!args.date) args.date = get_date_args().yyyy_mm;
		var dargs = get_date_args( args.date + '/01 00:00:00' );
		
		html += this.getStandardPageHeader({
			title: dargs.mmmm + ' ' + dargs.yyyy,
			subtitle: '(Newest on top)',
			date: args.date
		}); */
		
		html += '<div id="d_tag"><div class="loading_container"><div class="loading"></div></div></div>';
		
		this.div.html( html );
		
		// compose search query
		this.records = [];
		this.opts = {
			query: [
				'type:topic',
				'tags:' + tag.id
				// 'date:' + args.date
			].join(' ').trim(),
			offset: args.offset || 0,
			limit: config.items_per_page
		};
		app.api.get( 'app/search', this.opts, this.receiveTopics.bind(this) );
		
		return true;
	}
	
	getMiniPageHeader(args) {
		// return standard header box used by tags / locations pages
		// (no date nav, no sort label)
		var html = '';
		
		var size_widget = args.widget || '';
		if (!size_widget) {
			size_widget += '<span class="compact_view_link" onMouseUp="$P().setExpandedView(0)">Compact</span>';
			size_widget += '&nbsp;&nbsp;|&nbsp;&nbsp;';
			size_widget += '<span class="expanded_view_link" onMouseUp="$P().setExpandedView(1)">Expanded</span>';
		}
		
		html += '<div class="box" style="border:none;">';
			html += '<div class="box_title_doub">';
				// html += '<div class="box_title" style="grid-area:a; padding:0">' + args.title + '</div>';
				html += '<div class="box_subtitle" style="grid-area:a; text-align:left; color:var(--label-color)"><i class="mdi mdi-information-outline">&nbsp;</i><i>' + args.subtitle + '</i></div>';
				html += '<div class="box_subtitle" style="grid-area:b; text-align:right">' + size_widget + '</div>';
			html += '</div>'; // quad
		html += '</div>'; // box
		
		return html;
	}
	
	receiveTopics(resp) {
		// receive search results from server
		var self = this;
		var html = '';
		var $recent = this.div.find('#d_tag');
		
		$recent.find('.loading_container').remove();
		$recent.find('.load_more').remove();
		
		if (resp.total) {
			resp.records.forEach( function(record) {
				if (!self.userFilterRecord(record)) return;
				
				var idx = self.records.length;
				self.prepDisplayRecord(record, idx);
				self.records.push(record);
				
				html += '<div class="message_container mc_topic" data-idx="' + idx + '">';
					html += '<div class="box ' + (record.boxClass || '') + '">';
						html += '<div class="box_title subject"><a href="#View?id=' + record.id + '">' + record.disp.subject + '</a>';
							html += record.disp.admin;
							html += '<div>';
								html += '<div class="box_subtitle from">' + record.disp.from + '</div>';
								html += '<div class="box_subtitle date">' + record.disp.date + '</div>';
							html += '</div>';
						html += '</div>';
						html += '<div class="message_body">' + record.disp.body + '</div>';
						html += '<div class="message_footer">' + record.disp.foot_widgets.join('') + '<div class="clear"></div>' + '</div>';
					html += '</div>'; // box
				html += '</div>'; // message_container
			}); // forEach
		}
		if (!this.records.length) {
			html += '<div class="box"><div class="box_content"><div class="inline_page_message">No topics found for category "' + this.tag.title + '".</div></div></div>';
		}
		if (resp.total && (this.opts.offset + resp.records.length < resp.total)) {
			html += '<div class="load_more"><div class="button center" onMouseUp="$P().loadMoreTopics()"><i class="mdi mdi-arrow-down-circle-outline">&nbsp;</i>Load More...</div></div>';
		}
		
		$recent.append( html );
		this.expandInlineImages();
		this.onScrollDebounce();
	}
	
	onScrollDebounce() {
		// look for visible dirty ML suggestion widgets, and populate them
		this.updateSuggestions();
	}
	
	refresh() {
		// refresh search results from the top
		this.div.find('#d_tag').html( '<div class="loading_container"><div class="loading"></div></div>' );
		this.opts.offset = 0;
		app.api.get( 'app/search', this.opts, this.receiveTopics.bind(this) );
	}
	
	loadMoreTopics() {
		// load more search results, append to list
		this.div.find('.load_more').html( '<div class="loading"></div>' );
		this.opts.offset += config.items_per_page;
		app.api.get( 'app/search', this.opts, this.receiveTopics.bind(this) );
	}
	
	doQuickSearch(value) {
		// perform quick search for tag
		Nav.go( '#Search?query=' + encodeURIComponent(value) + '&tags=' + this.tag.id );
	}
	
	onDeactivate() {
		// called when page is deactivated
		// this.div.html( '' );
		$('#fe_header_search').attr('placeholder', 'Quick Search');
		this.lastScrollY = $(document).scrollTop();
		return true;
	}
	
};
