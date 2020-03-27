// Admin Page -- Activity Log

Page.ActivityLog = class ActivityLog extends Page.Base {
	
	onInit() {
		// called once at page load
		this.activity_types = {
			'^apikey': '<i class="mdi mdi-key-variant">&nbsp;</i>API Key',	
			'^user': '<i class="mdi mdi-account">&nbsp;</i>User',
			'^error': '<i class="mdi mdi-alert-decagram">&nbsp;</i>Error',
			'^warning': '<i class="mdi mdi-alert-circle">&nbsp;</i>Warning',
			'^notice': '<i class="mdi mdi-information-outline">&nbsp;</i>Notice',
			'^message': '<i class="mdi mdi-email-outline">&nbsp;</i>Message',
			'^ban': '<i class="mdi mdi-target-account">&nbsp;</i>Ban',
			'^tag': '<i class="mdi mdi-tag">&nbsp;</i>Category',
			'^location': '<i class="mdi mdi-map-marker">&nbsp;</i>Location',
			'^sorter': '<i class="mdi mdi-filter">&nbsp;</i>Sorter'
		};
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.showSidebar(true);
		app.setHeaderTitle( '<i class="mdi mdi-script-text-outline">&nbsp;</i>Activity Log' );
		app.setWindowTitle( "Activity Log" );
		
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		
		if (!args.offset) args.offset = 0;
		if (!args.limit) args.limit = 25;
		app.api.post( 'app/get_activity', copy_object(args), this.receive_activity.bind(this) );
		
		return true;
	}
	
	receive_activity(resp) {
		// receive page of activity from server, render it
		var self = this;
		var html = '';
		
		this.lastActivityResp = resp;
		this.events = [];
		if (resp.rows) this.events = resp.rows;
		
		var cols = ['Date/Time', 'Type', 'Description', 'Username', 'IP Address', 'Actions'];
		
		html += '<div class="box">';
		html += '<div class="box_title">';
			html += 'All Activity';
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
			
			// fudge username
			if (!item.username && item.user && item.user.username) item.username = item.user.username;
			
			switch (item.action) {
				
				// tags
				case 'tag_create':
					desc = 'New category created: <b>' + item.tag.title + '</b>';
					actions.push( '<a href="#Tags?sub=edit&id=' + item.tag.id + '">Edit Category</a>' );
				break;
				case 'tag_update':
					desc = 'Category updated: <b>' + item.tag.title + '</b>';
					actions.push( '<a href="#Tags?sub=edit&id=' + item.tag.id + '">Edit Category</a>' );
				break;
				case 'tag_delete':
					desc = 'Category deleted: <b>' + item.tag.title + '</b>';
				break;
				
				// locations
				case 'location_create':
					desc = 'New location created: <b>' + item.location.title + '</b>';
					actions.push( '<a href="#Locations?sub=edit&id=' + item.location.id + '">Edit Location</a>' );
				break;
				case 'location_update':
					desc = 'Location updated: <b>' + item.location.title + '</b>';
					actions.push( '<a href="#Locations?sub=edit&id=' + item.location.id + '">Edit Location</a>' );
				break;
				case 'location_delete':
					desc = 'Location deleted: <b>' + item.location.title + '</b>';
				break;
				
				// bans
				case 'ban_create':
					desc = 'New ban created: <b>' + item.ban.email + '</b>';
					actions.push( '<a href="#Bans?sub=edit&id=' + item.ban.id + '">Edit Ban</a>' );
				break;
				case 'ban_update':
					desc = 'Ban updated: <b>' + item.ban.email + '</b>';
					actions.push( '<a href="#Bans?sub=edit&id=' + item.ban.id + '">Edit Ban</a>' );
				break;
				case 'ban_delete':
					desc = 'Ban deleted: <b>' + item.ban.email + '</b>';
				break;
				
				// sorters
				case 'sorter_create':
					desc = 'New auto-sorter created: <b>' + item.sorter.id + '</b>';
					actions.push( '<a href="#Sorters?sub=edit&id=' + item.sorter.id + '">Edit Sorter</a>' );
				break;
				case 'sorter_update':
					desc = 'Auto-sorter updated: <b>' + item.sorter.id + '</b>';
					actions.push( '<a href="#Sorters?sub=edit&id=' + item.sorter.id + '">Edit Sorter</a>' );
				break;
				case 'sorter_delete':
					desc = 'Auto-sorter deleted: <b>' + item.sorter.id + '</b>';
				break;
				case 'sorter_multi_update':
					desc = 'Auto-sorter order changed';
				break;
				
				// messages
				case 'message_update':
					if (item.params.when) desc = 'Message added to calendar';
					else if (item.params.type) desc = 'Message type changed';
					else if (item.params.tags) desc = 'Message categories changed';
					else desc = 'Message updated';
					desc += ': <b>' + encode_entities(item.message.subject) + '</b> (' + item.message.from + ')';
					if (item.params.type) {
						// type was changed
						if (item.params.type == 'topic') actions.push( '<a href="#View?id=' + item.params.id + '">View Message</a>' );
						else actions.push( '<a href="#View?id=' + item.params.parent + '">View Thread</a>' );
					}
					else {
						if (item.message.parent) actions.push( '<a href="#View?id=' + item.message.parent + '">View Thread</a>' );
						else actions.push( '<a href="#View?id=' + item.params.id + '">View Message</a>' );
					}
				break;
				case 'message_delete':
					desc = 'Message deleted: <b>' + encode_entities(item.message.subject) + '</b> (' + item.message.from + ')';
				break;
				
				// api keys
				case 'apikey_create':
					desc = 'New API Key created: <b>' + item.api_key.title + '</b> (Key: ' + item.api_key.key + ')';
					actions.push( '<a href="#APIKeys?sub=edit&id=' + item.api_key.id + '">Edit Key</a>' );
				break;
				case 'apikey_update':
					desc = 'API Key updated: <b>' + item.api_key.title + '</b> (Key: ' + item.api_key.key + ')';
					actions.push( '<a href="#APIKeys?sub=edit&id=' + item.api_key.id + '">Edit Key</a>' );
				break;
				case 'apikey_delete':
					desc = 'API Key deleted: <b>' + item.api_key.title + '</b> (Key: ' + item.api_key.key + ')';
				break;
				
				// users
				case 'user_create':
					desc = 'New user created: <b>' + item.user.username + "</b> (" + item.user.full_name + ")";
					actions.push( '<a href="#Users?sub=edit&username=' + item.user.username + '">Edit User</a>' );
				break;
				case 'user_update':
					desc = 'User account updated: <b>' + item.user.username + "</b> (" + item.user.full_name + ")";
					actions.push( '<a href="#Users?sub=edit&username=' + item.user.username + '">Edit User</a>' );
				break;
				case 'user_delete':
					desc = 'User account deleted: <b>' + item.user.username + "</b> (" + item.user.full_name + ")";
				break;
				case 'user_login':
					desc = "User logged in: <b>" + item.user.username + "</b> (" + item.user.full_name + ")";
					actions.push( '<a href="#Users?sub=edit&username=' + item.user.username + '">Edit User</a>' );
				break;
				case 'user_password':
					desc = "User password was changed.";
					actions.push( '<a href="#Users?sub=edit&username=' + item.user.username + '">Edit User</a>' );
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
				
			} // action
			
			var tds = [
				'<div class="wrap_mobile">' + self.getNiceDateTimeText( item.epoch ) + '</div>',
				'<div class="td_big" style="white-space:nowrap; font-weight:normal;">' + item_type + '</div>',
				'<div class="activity_desc">' + desc + '</div>',
				'<div style="white-space:nowrap;">' + self.getNiceUsername(item, true) + '</div>',
				(item.ip || 'n/a').replace(/^\:\:ffff\:(\d+\.\d+\.\d+\.\d+)$/, '$1'),
				'<div style="white-space:nowrap;">' + actions.join(' | ') + '</div>'
			];
			if (color) tds.className = color;
			
			return tds;
			
		} ); // getPaginatedTable
		
		html += '</div>'; // box_content
		html += '</div>'; // box
		
		this.div.html( html );
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
