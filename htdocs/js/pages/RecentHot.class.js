Page.RecentHot = class RecentHot extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle('Hot Topics');
		app.setHeaderTitle( '<i class="mdi mdi-fire">&nbsp;</i>Hot Topics' );
		app.showSidebar(true);
		
		// resume if coming back
		var anchor = Nav.currentAnchor();
		if (anchor == this.lastAnchor) {
			$(document).scrollTop( this.lastScrollY );
			return true;
		}
		this.lastAnchor = anchor;
		
		var html = '';
		
		if (!args.date) args.date = get_date_args().yyyy_mm;
		var dargs = get_date_args( args.date + '/01 00:00:00' );
		
		html += this.getStandardPageHeader({
			title: dargs.mmmm + ' ' + dargs.yyyy,
			subtitle: '(Hottest on top)',
			date: args.date
		});
		
		html += '<div id="d_hot"><div class="loading_container"><div class="loading"></div></div></div>';
		
		this.div.html( html );
		
		// compose search query
		this.records = [];
		this.opts = {
			query: [
				'type:topic',
				'date:' + args.date,
				'replies:>0'
			].join(' ').trim(),
			offset: args.offset || 0,
			limit: config.items_per_page,
			sort_by: 'replies',
			sort_dir: '-1'
		};
		app.api.get( 'app/search', this.opts, this.receiveTopics.bind(this) );
		
		return true;
	}
	
	receiveTopics(resp) {
		// receive search results from server
		var self = this;
		var html = '';
		var $recent = this.div.find('#d_hot');
		
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
			html += '<div class="box"><div class="box_content"><div class="inline_page_message">No topics found for the current month.</div></div></div>';
		}
		if (resp.total && (this.opts.offset + resp.records.length < resp.total)) {
			html += '<div class="load_more"><div class="button center" onMouseUp="$P().loadMoreTopics()">Load More...</div></div>';
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
		this.div.find('#d_hot').html( '<div class="loading_container"><div class="loading"></div></div>' );
		this.opts.offset = 0;
		app.api.get( 'app/search', this.opts, this.receiveTopics.bind(this) );
	}
	
	loadMoreTopics() {
		// load more search results, append to list
		this.div.find('.load_more').html( '<div class="loading"></div>' );
		this.opts.offset += config.items_per_page;
		app.api.get( 'app/search', this.opts, this.receiveTopics.bind(this) );
	}
	
	onDeactivate() {
		// called when page is deactivated
		// this.div.html( '' );
		this.lastScrollY = $(document).scrollTop();
		return true;
	}
	
};
