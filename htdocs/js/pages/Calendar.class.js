Page.Calendar = class Calendar extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle('Calendar');
		app.setHeaderTitle( '<i class="mdi mdi-calendar-multiple">&nbsp;</i>Calendar of Events' );
		app.showSidebar(true);
		
		// customize quick search for this page
		$('#fe_header_search').attr('placeholder', 'Search Calendar...');
		
		// resume if coming back
		var anchor = Nav.currentAnchor();
		if (anchor == this.lastAnchor) {
			$(document).scrollTop( this.lastScrollY );
			return true;
		}
		this.lastAnchor = anchor;
		
		var html = '';
		
		var today = get_date_args();
		if (!args.date) args.date = today.yyyy_mm;
		var dargs = get_date_args( args.date + '/01 12:00:00' );
		this.dargs = dargs;
		
		var widget = '&nbsp;';
		if (dargs.yyyy_mm == today.yyyy_mm) {
			widget = '<span class="link" onMouseUp="$P().scrollToToday()"><i class="mdi mdi-arrow-down-circle-outline">&nbsp;</i>Jump to Today</span>';
		}
		this.isCurrentMonth = !!(dargs.yyyy_mm == today.yyyy_mm);
		
		html += this.getStandardPageHeader({
			title: '' + dargs.mmmm + ' ' + dargs.yyyy,
			subtitle: '(Sorted by date)',
			widget: widget,
			date: args.date,
			future: true
		});
		
		html += '<div id="d_calendar"><div class="loading_container"><div class="loading"></div></div></div>';
		
		this.div.html( html );
		
		// compose search query
		this.records = [];
		this.opts = {
			query: [
				'type:topic',
				'tags:events',
				'when:' + args.date
			].join(' ').trim(),
			compact: 1, // no body
			offset: 0,
			limit: 1000
		};
		app.api.get( 'app/search', this.opts, this.receiveEvents.bind(this) );
		
		return true;
	}
	
	receiveEvents(resp) {
		// receive search results from server
		// console.log( resp );
		var self = this;
		var args = this.args;
		var html = '';
		var $calendar = this.div.find('#d_calendar');
		var epoch = this.dargs.epoch;
		var dargs = get_date_args( epoch );
		var today_dargs = get_date_args();
		var count = 0;
		if (!resp.records) resp.records = [];
		
		var good_records = resp.records.filter( function(record) {
			if (!self.userFilterRecord(record)) return false;
			if (!record.tags || !record.when) return false; // sanity
			return true;
		});
		
		while (dargs.yyyy_mm == this.dargs.yyyy_mm) {
			var nice_date = format_date(epoch, '[dddd], [mmmm] [mday]');
			var is_today = !!(dargs.yyyy_mm_dd == today_dargs.yyyy_mm_dd);
			
			if (is_today) html += '<div class="today"></div>'; // anchor / scroll point
			
			var records = good_records.filter( function(record) {
				return (record.when.indexOf(dargs.yyyy_mm_dd) > -1);
			});
			
			if (records.length || is_today) {
				html += '<div class="box cal ' + (is_today ? 'today' : '') + '">';
				html += '<div class="box_title"><i class="mdi mdi-calendar-text">&nbsp;</i>' + nice_date + (is_today ? ' (Today)' : '') + '</div>';
				html += '<div class="box_content" style="padding-top:0;">';
				
				records.forEach( function(record) {
					var nice_subject = self.getNiceSubject( record.title || record.subject );
					
					var widgets = [];
					widgets.push(
						self.getNiceFrom(record.from)
					);
					
					var dates = record.when.split(/\,\s*/);
					var nice_start_date = format_date( dates[0], '[mmm] [mday]' );
					var nice_end_date = format_date( dates[dates.length - 1], '[mmm] [mday]' );
					var nice_date_range = '<i class="mdi mdi-calendar-blank">&nbsp;</i>' + nice_start_date;
					if (nice_end_date != nice_start_date) nice_date_range += ' - ' + nice_end_date;
					// widgets.push( nice_date_range );
					
					var tags = self.recordRemoveTagCSV(record.tags, 'events');
					if (tags) {
						widgets.push( self.getNiceTagList(tags, true) );
					}
					if (record.locations) {
						widgets.push( self.getNiceLocationList(record.locations, true) );
					}
					widgets = widgets.map( function(widget, idx) {
						return '<div class="message_footer_widget ' + ((idx == widgets.length - 1) ? 'last' : '') + '">' + widget + '</div>';
					});
					
					html += '<div class="cal_event">';
						html += '<div class="cal_subject"><a href="#View?id=' + record.id + '">' + nice_subject + '</a></div>';
						html += '<div class="cal_footer">' + widgets.join('') + '<div class="clear"></div>' + '</div>';
					html += '</div>';
					
					count++;
				}); // foreach record
				
				if (!records.length) {
					html += '<div class="cal_event">';
						html += '<div class="cal_footer" style="font-style:italic">No events today!</div>';
					html += '</div>';
				}
				
				html += '</div>'; // box_content
				html += '</div>'; // box
			}
			else if (0) {
				html += '<div class="inline_page_message ' + (is_today ? 'today' : '') + '" style="margin-top:10px; margin-bottom:10px;">';
					html += '<i class="mdi mdi-tilde"></i>&nbsp;';
					html += 'No events for ' + nice_date;
					html += '&nbsp;<i class="mdi mdi-tilde"></i>';
				html += '</div>';
			}
			
			// since we started at noon, this avoids DST issues
			epoch += 86400;
			dargs = get_date_args( epoch );
		} // foreach mday
		
		if (!count) {
			html += '<div class="box"><div class="box_content"><div class="inline_page_message">No events found for the current month.</div></div></div>';
		}
		
		$calendar.html( html );
		
		if (this.isCurrentMonth) this.scrollToToday();
	}
	
	scrollToToday() {
		// scroll down to today marker
		// $(document).scrollTop( this.div.find('div.today').offset().top );
		this.div.find('div.today')[0].scrollIntoView(true);
		
		// nudge this so it looks a bit better
		$(document).scrollTop( $(document).scrollTop() - (app.mobile ? 15 : 30) );
	}
	
	doQuickSearch(value) {
		// perform quick search for calendar
		Nav.go( '#Search?query=' + encodeURIComponent(value) + '&tags=events' );
	}
	
	onDeactivate() {
		// called when page is deactivated
		// this.div.html( '' );
		$('#fe_header_search').attr('placeholder', 'Quick Search');
		this.lastScrollY = $(document).scrollTop();
		return true;
	}
	
};
