// Admin Page -- Site Stats

Page.Stats = class PageStats extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '<i class="mdi mdi-finance">&nbsp;</i>Site Statistics' );
		app.setWindowTitle( "Site Statistics" );
		
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		
		app.api.post( 'app/admin_stats', {}, this.receive_stats.bind(this) );
		
		return true;
	}
	
	renderStat(key, value) {
		// return HTML elements for stat item
		var html = '';
		html += '<div class="stat_row">';
			html += '<div class="stat_key">' + key + ':</div>';
			html += '<div class="stat_value">' + value + '</div>';
		html += '</div>';
		return html;
	}
	
	receive_stats(resp) {
		// receive stats from server, render it
		var self = this;
		var html = '';
		var stats = resp.stats;
		
		html += '<div class="stat_box_row">';
		
		////
		// Daily Totals
		////
		html += '<div class="box stat_box">';
		html += '<div class="box_title">';
			html += '<i class="mdi mdi-calendar-today">&nbsp;</i>';
			html += 'Daily Totals';
			// html += '<div class="box_subtitle">(Resets at midnight)</div>';
		html += '</div>';
		html += '<div class="box_content">';
		
			var elapsed = stats.day.timeElapsed;
			
			html += this.renderStat(
				'Site Visitors', 
				commify(stats.day.transactions.visitors || 0) 
			);
			html += this.renderStat(
				'Web Requests', 
				commify(stats.day.requests || 0) // + ' (' + Math.floor((stats.day.requests || 0) / elapsed) + '/sec)'
			);
			html += this.renderStat(
				'Bandwith In', 
				get_text_from_bytes(stats.day.bytes_in || 0) // + ' (' + get_text_from_bytes((stats.day.bytes_in || 0) / elapsed) + '/sec)'
			);
			html += this.renderStat(
				'Bandwith Out', 
				get_text_from_bytes(stats.day.bytes_out || 0) // + ' (' + get_text_from_bytes((stats.day.bytes_out || 0) / elapsed) + '/sec)'
			);
			
			html += this.renderStat(
				'Messages Posted', 
				commify(stats.day.transactions.message_post || 0) 
			);
			// html += this.renderStat(
			// 	'Messages Favorited', 
			// 	commify(stats.day.transactions.message_fav || 0) 
			// );
			html += this.renderStat(
				'Searches Performed', 
				commify(stats.day.transactions.search || 0) 
			);
			html += this.renderStat(
				'Users Logged In', 
				commify(stats.day.transactions.user_login || 0) 
			);
			html += this.renderStat(
				'New Users Created', 
				commify(stats.day.transactions.user_create || 0) 
			);
			html += this.renderStat(
				'Search Alerts Triggered', 
				commify(stats.day.transactions.user_search_trigger || 0) 
			);
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		////
		// Database
		////
		html += '<div class="box stat_box">';
		html += '<div class="box_title">';
			html += '<i class="mdi mdi-database">&nbsp;</i>';
			html += 'Database Stats';
			// html += '<div class="box_subtitle">(Resets at midnight)</div>';
		html += '</div>';
		html += '<div class="box_content">';
		
			html += this.renderStat(
				'Total Records', 
				commify(stats.db.records || 0) 
			);
			html += this.renderStat(
				'Total Topics', 
				commify(stats.db.topics || 0) 
			);
			html += this.renderStat(
				'Total Replies', 
				commify(stats.db.replies || 0) 
			);
			html += this.renderStat(
				'Total Users', 
				commify(stats.db.users || 0) 
			);
			html += this.renderStat(
				'Total Search Alerts', 
				commify(stats.db.searchTriggers || 0) 
			);
			html += this.renderStat(
				'Total Disk Size', 
				get_text_from_bytes(stats.db.bytes || 0) 
			);
			
			html += this.renderStat(
				'Storage Cache Items', 
				commify(stats.cache.count || 0) 
			);
			html += this.renderStat(
				'Storage Cache Size', 
				get_text_from_bytes(stats.cache.bytes || 0) 
			);
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		html += '</div>'; // stat_box_row
		
		html += '<div class="stat_box_row">';
		
		////
		// Server Resources
		////
		html += '<div class="box stat_box">';
		html += '<div class="box_title">';
			html += '<i class="mdi mdi-server-network">&nbsp;</i>';
			html += 'Server Resources';
			// html += '<div class="box_subtitle">(Resets at midnight)</div>';
		html += '</div>';
		html += '<div class="box_content">';
		
			html += this.renderStat(
				'Main Process CPU', 
				pct(stats.cpu.main || 0, 100) 
			);
			html += this.renderStat(
				'Main Process Memory', 
				get_text_from_bytes(stats.mem.main || 0) 
			);
			
			html += this.renderStat(
				'ML Process CPU', 
				pct(stats.cpu.ml || 0, 100) 
			);
			html += this.renderStat(
				'ML Process Memory', 
				get_text_from_bytes(stats.mem.ml || 0) 
			);
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		////
		// Machine Learning
		////
		html += '<div class="box stat_box">';
		html += '<div class="box_title">';
			html += '<i class="mdi mdi-robot">&nbsp;</i>';
			html += 'Machine Learning';
			// html += '<div class="box_subtitle">(Resets at midnight)</div>';
		html += '</div>';
		html += '<div class="box_content">';
		
			html += this.renderStat(
				'Engine', 
				stats.ml.engine + ' v' + stats.ml.version
			);
			// html += this.renderStat(
			// 	'Version', 
			// 	stats.ml.version
			// );
			
			html += this.renderStat(
				'Training File Size', 
				get_text_from_bytes(stats.ml.train || 0) 
			);
			html += this.renderStat(
				'Model File Size', 
				get_text_from_bytes(stats.ml.model || 0) 
			);
			
			html += this.renderStat(
				'Avg Prediction Time', 
				short_float( (stats.day.ml_elapsed_ms || 0) / (stats.day.ml_count || 1) ) + ' ms' 
			);
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		html += '</div>'; // stat_box_row
		
		this.div.html( html );
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
