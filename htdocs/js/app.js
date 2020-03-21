// Mendo.org Web App
// Author: Joseph Huckaby
// Copyright (c) 2019 - 2020 Joseph Huckaby

if (!window.app) throw new Error("App Framework is not present.");

app.extend({
	
	name: '',
	preload_images: [],
	plain_text_post: false,
	default_prefs: {
		reply_sender: true,
		reply_listserv: true,
		expand_views: true
	},
	debug_cats: {
		all: true,
		api: true
	},
	
	receiveConfig: function(resp) {
		// receive config from server
		delete resp.code;
		window.config = resp.config;
		
		if (config.debug) {
			Debug.enable( this.debug_cats );
			Debug.trace('system', "Mendo.org Client Starting Up");
		}
		
		// load prefs and populate for first time users
		this.initPrefs();
		
		// setup theme (light / dark)
		this.initTheme();
		
		for (var key in resp) {
			this[key] = resp[key];
		}
		
		// allow visible app name to be changed in config
		this.name = config.name;
		
		this.config.Page = [
			{ ID: 'Home' },
			{ ID: 'RecentNew' },
			{ ID: 'RecentHot' },
			{ ID: 'Calendar' },
			{ ID: 'Favorites' },
			{ ID: 'Search' },
			{ ID: 'NewTopic' },
			{ ID: 'Tag' },
			{ ID: 'Location' },
			{ ID: 'View' },
			{ ID: 'Document' },
			{ ID: 'Login' },
			{ ID: 'Verify' },
			{ ID: 'MyAccount' },
			{ ID: 'MySecurity' },
			{ ID: 'MySettings' },
			{ ID: 'APIKeys' },
			{ ID: 'Tags' },
			{ ID: 'Locations' },
			{ ID: 'Bans' },
			{ ID: 'Users' },
			{ ID: 'ActivityLog' },
			{ ID: 'Stats' }
		];
		this.config.DefaultPage = 'Home';
		
		// did we try to init and fail?  if so, try again now
		if (this.initReady) {
			Dialog.hideProgress();
			delete this.initReady;
			this.init();
		}
	},
	
	init: function() {
		// initialize application
		if (this.abort) return; // fatal error, do not initialize app
		
		if (!this.config) {
			// must be in master server wait loop
			this.initReady = true;
			return;
		}
		
		// preload a few essential images
		for (var idx = 0, len = this.preload_images.length; idx < len; idx++) {
			var filename = '' + this.preload_images[idx];
			var img = new Image();
			img.src = '/images/'+filename;
		}
		
		// pop version into footer
		$('#d_footer_version').html( "Version " + this.version || 0 );
		// $('#d_footer_version').html( get_inner_window_size().width );
		
		// some css munging for browser weirdness
		var ua = navigator.userAgent;
		if (ua.match(/Safari/) && !ua.match(/(Chrome|Opera|Edge)/)) {
			$('body').addClass('safari');
		}
		else if (ua.match(/Chrome/)) {
			$('body').addClass('chrome');
		}
		else if (ua.match(/Firefox/)) {
			$('body').addClass('firefox');
		}
		else if (ua.match(/(MSIE|Trident)/)) {
			$('body').addClass('ie');
		}
		
		// restore expanded/compact view pref (implemented as CSS)
		if (!this.getPref('expand_views')) $('body').addClass('compact');
		
		// hook up mobile sidebar pullover
		$('#d_sidebar_toggle').on('mouseup', function() { app.pullSidebar(); } );
		
		// only perform touch nav (horiz swipe) for mobile webapp
		if (window.navigator.standalone) this.setupTouchNav();
		
		window.addEventListener( "scroll", debounce(this.onScrollDebounce.bind(this), 250), false );
		
		this.cacheBust = time_now();
		this.page_manager = new PageManager( always_array(config.Page) );
		
		if (!Nav.inited) Nav.init();
	},
	
	updateHeaderInfo: function(bust) {
		// update top-right display
		var html = '';
		// html += '<div class="header_widget user" style="background-image:url(' + this.getUserAvatarURL( this.retina ? 64 : 32, bust ) + ')" onMouseUp="app.doMyAccount()" title="My Account"></div>';
		html += '<div class="header_widget icon"><i class="mdi mdi-logout" onMouseUp="app.doUserLogout()" title="Logout"></i></div>';
		html += '<div class="header_widget icon"><i class="mdi mdi-account" onMouseUp="app.doMyAccount()" title="My Account"></i></div>';
		html += '<div class="header_widget icon"><i class="mdi mdi-settings" onMouseUp="app.doMySettings()" title="Edit Settings"></i></div>';
		html += '<div id="d_theme_ctrl" class="header_widget icon" onMouseUp="app.toggleTheme()" title="Toggle Light/Dark Theme"></div>';
		// html += '<div class="header_widget icon"><i class="mdi mdi-file-document-edit-outline" onMouseUp="app.doNewTopic()" title="Post New Topic"></i></div>';
		
		html += '<div class="header_search_widget"><i class="mdi mdi-magnify">&nbsp;</i><input type="text" size="15" id="fe_header_search" placeholder="Quick Search" onKeyDown="app.qsKeyDown(this,event)"/></div>';
		$('#d_header_user_container').html( html );
		this.initTheme();
		this.initSidebarTabs();
	},
	
	qsKeyDown: function(elem, event) {
		// capture enter key in header search
		if ((event.keyCode == 13) && elem.value.length) {
			event.preventDefault();
			$P().doQuickSearch( elem.value );
			elem.value = '';
		}
	},
	
	doNewTopic: function() {
		// jump to the NewTopic page
		Nav.go('NewTopic');
	},
	
	doMySettings: function() {
		// jump to the MySettings page
		Nav.go('MySettings');
	},
	
	initSidebarTabs: function() {
		// setup dynamic tabs
		// $('div.sidebar a.section_item').off('mouseup');
		
		// tag (category) tabs
		var $section = $('#d_section_tags').empty();
		this.tags.sort( function(a, b) {
			return a.title.localeCompare( b.title );
		} );
		this.tags.forEach( function(tag) {
			var $tag = $('<a></a>')
				.prop('id', 'tab_Tag_' + tag.id)
				.attr('href', '#Tag?id=' + tag.id)
				.addClass('section_item' + (app.user.exclude_tags.includes(tag.id) ? ' filtered' : '') )
				.html( '<i class="mdi mdi-' + (tag.icon || 'tag') + '">&nbsp;</i>' + tag.title );
			$section.append( $tag );
		} );
		
		// location tabs
		$section = $('#d_section_locations').empty();
		this.locations.sort( function(a, b) {
			return a.id.localeCompare( b.id );
		} );
		this.locations.forEach( function(loc) {
			var $loc = $('<a></a>')
				.prop('id', 'tab_Location_' + loc.id)
				.attr('href', '#Location?id=' + loc.id)
				.addClass('section_item')
				.html( '<i class="mdi mdi-map-marker">&nbsp;</i>' + loc.title );
			$section.append( $loc );
		} );
		
		// user searches
		$section = $('#d_section_my_searches').empty();
		if (this.user.searches.length) {
			this.user.searches.sort( function(a, b) {
				return a.name.localeCompare( b.name );
			} );
			this.user.searches.forEach( function(search) {
				var $search = $('<a></a>')
					.prop('id', 'tab_Search_' + search.name.replace(/\W+/g, ''))
					.attr('href', '#Search?preset=' + search.name)
					.addClass('section_item')
					.html( '<i class="mdi mdi-' + (search.alerts ? 'bell' : 'magnify') + '">&nbsp;</i>' + search.name );
				$section.append( $search );
			} );
		}
		else {
			$section.append( '<div class="section_item disabled">(None found)</div>' );
		}
		
		// $('div.sidebar a.section_item').on('mouseup', function() {
		// 	app.pushSidebar();
		// });
		
		// calling this again to recalculate sidebar expandable group heights, for animation toggle thing
		setTimeout( function() { app.page_manager.initSidebar(); }, 1 );
	},
	
	doUserLogin: function(resp) {
		// user login, called from login page, or session recover
		// overriding this from base.js
		delete resp.code;
		
		for (var key in resp) {
			this[key] = resp[key];
		}
		
		this.setPref('username', resp.username);
		this.setPref('session_id', resp.session_id);
		
		this.updateHeaderInfo();
		
		// show admin tab if user is worthy
		if (this.isAdmin()) {
			$('#d_sidebar_admin_group').show();
			$('body').addClass('admin');
		}
		else {
			$('#d_sidebar_admin_group').hide();
			$('body').removeClass('admin');
		}
		
		// compile bad words regexp
		this.badWordMatch = new RegExp( this.badWordMatchStr, 'ig' );
		
		// pre-compile user filter regexps
		this.prepUser();
	},
	
	doUserLogout: function(bad_cookie) {
		// log user out and redirect to login screen
		var self = this;
		
		if (!bad_cookie) {
			// user explicitly logging out
			Dialog.showProgress(1.0, "Logging out...");
			this.setPref('username', '');
		}
		
		this.api.post( 'user/logout', {
			session_id: this.getPref('session_id')
		}, 
		function(resp, tx) {
			Dialog.hideProgress();
			delete self.user;
			delete self.username;
			delete self.user_info;
			delete app.navAfterLogin;
			
			self.setPref('session_id', '');
			$('#d_header_user_container').html( '' );
			
			if (app.config.external_users) {
				// external user api
				Debug.trace("User session cookie was deleted, querying external user API");
				setTimeout( function() {
					if (bad_cookie) app.doExternalLogin(); 
					else app.doExternalLogout(); 
				}, 250 );
			}
			else {
				Debug.trace("User session cookie was deleted, redirecting to login page");
				Dialog.hideProgress();
				Nav.go('Home');
			}
			
			setTimeout( function() {
				if (!app.config.external_users) {
					if (bad_cookie) self.showMessage('error', "Your session has expired.  Please log in again.");
					else self.showMessage('success', "You were logged out successfully.");
				}
			}, 150 );
			
			$('#d_sidebar_admin_group').hide();
			$('body').removeClass('admin');
		} );
	},
	
	doExternalLogin: function() {
		// login using external user management system
		// Force API to hit current page hostname vs. master server, so login redirect URL reflects it
		app.api.post( '/api/user/external_login', { cookie: document.cookie }, function(resp) {
			if (resp.user) {
				Debug.trace("User Session Resume: " + resp.username + ": " + resp.session_id);
				Dialog.hideProgress();
				app.doUserLogin( resp );
				Nav.refresh();
			}
			else if (resp.location) {
				Debug.trace("External User API requires redirect");
				Dialog.showProgress(1.0, "Logging in...");
				setTimeout( function() { window.location = resp.location; }, 250 );
			}
			else app.doError(resp.description || "Unknown login error.");
		} );
	},
	
	doExternalLogout: function() {
		// redirect to external user management system for logout
		var url = app.config.external_user_api;
		url += (url.match(/\?/) ? '&' : '?') + 'logout=1';
		
		Debug.trace("External User API requires redirect");
		Dialog.showProgress(1.0, "Logging out...");
		setTimeout( function() { window.location = url; }, 250 );
	},
	
	get_password_toggle_html: function() {
		// get html for a password toggle control
		return '<span class="link password_toggle" onMouseUp="app.toggle_password_field(this)">&laquo;&nbsp;Show</span>';
	},
	
	toggle_password_field: function(span) {
		// toggle password field visible / masked
		var $span = $(span);
		// var $field = $span.prev();
		var $field = $span.closest('.form_row').find('input');
		if ($field.attr('type') == 'password') {
			$field.attr('type', 'text');
			$span.html( '&laquo; Hide' );
		}
		else {
			$field.attr('type', 'password');
			$span.html( '&laquo; Show' );
		}
	},
	
	prepUser: function() {
		// pre-compile user filter regexps
		this.userExcludeFromMatch = this.user.exclude_froms.length ?
			new RegExp( "\\b(" + this.user.exclude_froms.map(escape_regexp).join('|') + ")\\b", "i" ) :
			new RegExp( "(?!)" );
		
		this.userExcludeTagMatch = this.user.exclude_tags.length ?
			new RegExp( "\\b(" + this.user.exclude_tags.map(escape_regexp).join('|') + ")\\b", "i" ) :
			new RegExp( "(?!)" );
	},
	
	clearPageAnchorCache: function() {
		// clear all pages lastAnchor property, except for current page
		// used for some extra cacheBust action
		this.page_manager.pages.forEach( function(page) {
			if (page.ID != app.page_manager.current_page_id) delete page.lastAnchor;
		});
	},
	
	onScrollDebounce: function() {
		// called every so often while scrolling
		if (app.page_manager && app.page_manager.current_page_id) {
			var page = app.page_manager.find(app.page_manager.current_page_id);
			if (page && page.onScrollDebounce) page.onScrollDebounce();
		}
	},
	
	setupTouchNav: function() {
		// listen for touch events for nav swipes
		this.touchOrigin = {};
		this.touchCurrent = {};
		
		document.addEventListener( 'touchstart', this.touchStart.bind(this), false );
		document.addEventListener( 'touchmove', this.touchMove.bind(this), false );
		document.addEventListener( 'touchend', this.touchEnd.bind(this), false );
	},
	
	touchStart: function(event) {
		// record finger starting position
		var touch = event.touches[0];
		this.touchOrigin.x = touch.screenX;
		this.touchOrigin.y = touch.screenY;
	},
	
	touchMove: function(event) {
		// track finger movement while dragging
		var touch = event.touches[0];
		this.touchCurrent.x = touch.screenX;
		this.touchCurrent.y = touch.screenY;
	},
	
	touchEnd: function(event) {
		// finger lifted off the screen, check for swipe
		var pt = this.touchCurrent;
		var dx = Math.abs( pt.x - this.touchOrigin.x );
		var dy = Math.abs( pt.y - this.touchOrigin.y );
		var swipe_threshold = this.swipeThreshold || 100;
		
		if (Math.max(dx, dy) >= swipe_threshold) {
			var direction = '';
			if (dx > dy) {
				// horiz swipe
				direction = ((pt.x - this.touchOrigin.x) > 0) ? 'right' : 'left';
			}
			else {
				// vert swipe
				direction = ((pt.y - this.touchOrigin.y) > 0) ? 'down' : 'up';
			}
			
			switch (direction) {
				case 'left': history.go(1); break;
				case 'right': history.go(-1); break;
			}
		} // swiped
	}
	
}); // app
