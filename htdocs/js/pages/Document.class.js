Page.Document = class Document extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle('View Document');
		
		if (app.user) {
			// user is logged in
			app.setHeaderTitle( '<i class="mdi mdi-file-document-outline">&nbsp;</i>View Document' );
			app.showSidebar(true);
			
			// highlight our pseudo-tab
			$('.sidebar .section_item').removeClass('active').addClass('inactive');
			$('#tab_Document_' + args.id).removeClass('inactive').addClass('active');
		}
		else if (app.getPref('session_id')) {
			// user has cookie
			this.requireLogin(args);
			return true;
		}
		else {
			// user is NOT logged in
			app.setHeaderTitle( '' );
			app.showSidebar(false);
			$('body').addClass('relative');
			
			// add create / login buttons to header
			var html = '';
			html += '<div id="d_theme_ctrl" class="header_widget icon" onMouseUp="app.toggleTheme()" title="Toggle Light/Dark Theme"></div>';
			if (config.free_accounts) {
				html += '<div class="header_widget button" onMouseUp="$P().doCreateAccount()"><i class="mdi mdi-account-plus">&nbsp;</i><span>Sign Up...</span></div>';
			}
			html += '<div class="header_widget button" onMouseUp="$P().doLogin()"><i class="mdi mdi-key">&nbsp;</i><span>Login...</span></div>';
			
			$('#d_header_user_container').html( html );
			app.initTheme();
		}
		
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		app.api.get( 'app/doc', { id: args.id }, this.receiveDoc.bind(this) );
		
		return true;
	}
	
	receiveDoc(resp) {
		// receive markdown from server, render it
		var html = '';
		
		html += '<div class="box">';
		html += '<div class="box_content">';
		html += '<div class="markdown-body" style="' + (app.user ? this.getUserFontStyle() : 'font-size:16px') + '">';
		
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
	
	doCreateAccount() {
		Nav.go('Login?create=1');
	}
	
	doLogin() {
		Nav.go('Login');
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		if (!app.user) {
			$('body').removeClass('relative');
			$('#d_header_user_container').html('');
		}
		return true;
	}
	
};
