Page.Document = class Document extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle('View Document');
		
		if (args.standalone) {
			// standalone mode, no login, no prefs, no header, no footer
			app.setHeaderTitle( '' );
			app.showSidebar(false);
			$('body').addClass('relative');
			app.setTheme('light');
			$('.header').hide();
			$('#d_footer').hide();
		}
		else if (app.user) {
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
		app.api.get( 'app/doc', args, this.receiveDoc.bind(this), this.fullPageError.bind(this) );
		
		return true;
	}
	
	receiveDoc(resp) {
		// receive markdown from server, render it
		var html = '';
		var text = resp.data;
		var args = this.args;
		
		if ((typeof(text) == 'object') && text.subject && text.body) {
			// viewing DB record as document
			var record = resp.data;
			text = "";
			if (args.subject) text += "# " + record.subject + "\n\n";
			text += record.body;
		}
		
		// promote first heading into title, if user is logged in and it's a level 1 or 2 header
		if (app.user && !args.standalone && text.match(/^\#{1,2}\s+([^\n]+)\n\n/)) {
			var title = RegExp.$1;
			app.setWindowTitle( title );
			app.setHeaderTitle( '<i class="mdi mdi-file-document-outline">&nbsp;</i>' + title );
			text = text.replace(/^\#{1,2}\s+([^\n]+)\n\n/, '');
		}
		
		html += '<div class="box">';
		html += '<div class="box_content">';
		html += '<div class="markdown-body code" style="' + (app.user ? this.getUserFontStyle() : 'font-size:16px') + '">';
		// html += '<div class="markdown-body code" style="font-size:16px">';
		
		html += marked(text, {
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
		this.expandInlineImages();
	}
	
	expandInlineImages(elem) {
		// expand all inline image URLs in doc
		var self = this;
		if (!elem) elem = this.div;
		
		elem.find('div.markdown-body p a').each( function() {
			var $this = $(this);
			var href = $this.attr('href') || '';
			if (!href.match(/\.(jpg|jpeg|gif|png)(\?|$)/i)) return; // supported images only
			if ($this.data('expanded')) return; // do not re-expand an expanded link
			if ($this.next().length) return; // only process links at the end of parent blocks
			
			$this.after('<img src="' + href + '" class="inline_image" onMouseUp="window.open(this.src)">');
			// $this.data('expanded', true);
			$this.remove();
		});
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
			$('.header').show();
			$('#d_footer').show();
			app.initTheme();
		}
		return true;
	}
	
};
