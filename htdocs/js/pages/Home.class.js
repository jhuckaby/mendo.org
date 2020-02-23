Page.Home = class Home extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		var self = this;
		
		// if user is logged in or has a cookie, redirect now
		if (app.user || app.getPref('session_id')) {
			setTimeout( function() { Nav.go('RecentNew'); }, 1 );
			return true;
		}
		
		app.setWindowTitle('Home');
		app.setHeaderTitle( '' );
		app.showSidebar(false);
		$('body').addClass('relative');
		
		// add create / login buttons to header
		var html = '';
		html += '<div id="d_theme_ctrl" class="header_widget icon" onMouseUp="$P().toggleTheme()" title="Toggle Light/Dark Theme"></div>';
		if (config.free_accounts) {
			html += '<div class="header_widget button" onMouseUp="$P().doCreateAccount()"><i class="mdi mdi-account-plus">&nbsp;</i><span>Sign Up...</span></div>';
		}
		html += '<div class="header_widget button" onMouseUp="$P().doLogin()"><i class="mdi mdi-key">&nbsp;</i><span>Login...</span></div>';
		$('#d_header_user_container').html( html );
		app.initTheme();
		
		// preload themed iPad screenshots
		this.images = ['images/ipad-screenshot-light-sm.png', 'images/ipad-screenshot-dark-sm.png'].map( function(url) {
			var img = new Image();
			img.src = url;
			return img;
		} );
		
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		app.api.get( 'app/doc', { id: 'welcome' }, this.receiveDoc.bind(this) );
		return true;
	}
	
	receiveDoc(resp) {
		// receive markdown from server, render it
		var html = '';
		
		html += '<div class="box">';
		html += '<div class="box_content">';
		// html += '<div class="markdown-body" style="' + this.getUserFontStyle() + '">';
		html += '<div class="markdown-body" style="font-size:16px;">';
		
		html += '<img id="i_welcome_hero" src="images/ipad-screenshot-' + app.getPref('theme') + '-sm.png" align="right">';
		
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
		
		this.div.html(html);
	}
	
	toggleTheme() {
		// toggle theme and update hero image
		app.toggleTheme();
		this.div.find('#i_welcome_hero').attr('src', 'images/ipad-screenshot-' + app.getPref('theme') + '-sm.png');
	}
	
	doCreateAccount() {
		Nav.go('Login?create=1');
	}
	
	doLogin() {
		Nav.go('Login');
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		$('body').removeClass('relative');
		if (!app.user) $('#d_header_user_container').html('');
		return true;
	}
	
};
