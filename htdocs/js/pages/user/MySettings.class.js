
Page.MySettings = class MySettings extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle('Preferences');
		app.setHeaderTitle( '<i class="mdi mdi-cog">&nbsp;</i>User Settings' );
		app.showSidebar(true);
		
		this.receiveUser({ user: app.user });
		return true;
	}
	
	receiveUser(resp, tx) {
		var self = this;
		var html = '';
		var user = resp.user;
		
		html += '<div class="box">';
		html += '<div class="box_title">Preferences</div>';
		html += '<div class="box_content">';
		
		// Date/Time Format
		var now = time_now();
		var dt_fmts = [
			'[dddd], [mmmm] [d], [yyyy], [h12]:[mi] [ampm]',
			'[mmmm] [d], [yyyy], [h12]:[mi] [ampm]',
			
			'[ddd] [mmm] [d] [yyyy] [h12]:[mi] [ampm]',
			'[mmm] [d] [yyyy] [h12]:[mi] [ampm]',
			
			'[mm]/[dd]/[yyyy] [h12]:[mi] [ampm]',
			'[mm]/[dd]/[yyyy] [hh]:[mi]:[ss]',
			
			'[yyyy]/[mm]/[dd] [h12]:[mi] [ampm]',
			'[yyyy]/[mm]/[dd] [hh]:[mi]:[ss]'
		].map( function(fmt) {
			return [ fmt, format_date(now, fmt) ];
		});
		
		html += this.getFormRow({
			label: 'Date/Time Format:',
			content: this.getFormMenu({
				id: 'fe_ms_date_fmt',
				options: dt_fmts,
				value: user.date_format || ''
			}),
			caption: 'Choose your desired date/time format.  Times are always adjusted to your local timezone.'
		});
		
		// Markdown / Plain Text
		html += this.getFormRow({
			label: 'Display Format:',
			content: this.getFormMenu({
				id: 'fe_ms_text_fmt',
				options: [['markdown',"Rich Text (Markdown)"], ['text',"Plain Text"]],
				value: user.text_format || ''
			}),
			caption: 'Choose your desired text format for reading posts.  Note that only Rich Text (Markdown) mode supports inline images.  You can read more about rich text formatting <a href="#Document?id=markdown">here</a>.'
		});
		
		// Font Family
		html += this.getFormRow({
			label: 'Display Font:',
			content: this.getFormMenu({
				id: 'fe_ms_font_family',
				options: [
					['Bookman, serif', "Bookman"],
					['Courier, monospace', "Courier (Monospace)"],
					['Garamond, serif', "Garamond"],
					['Georgia, serif', "Georgia"],
					['Helvetiva, Arial, sans-serif', "Helvetica / Arial"],
					['Lato', "Lato (Default)"], 
					['Palatino, serif', "Palatino"],
					['Times New Roman, Times, serif', "Times New Roman"],
					['Verdana, sans-serif', "Verdana"]
				],
				value: user.font_family || 'Lato',
				onChange: '$P().updateExampleText()'
			}),
			suffix: '<div id="d_ms_example_text">(Example text)</div>',
			caption: 'Choose your desired display font for reading and composing posts.'
		});
		
		// Font Size
		html += this.getFormRow({
			label: 'Font Size:',
			content: this.getFormMenu({
				id: 'fe_ms_font_size',
				options: [
					['11px', "11pt"],
					['12px', "12pt"],
					['13px', "13pt"],
					['14px', "14pt (Default)"],
					['15px', "15pt"],
					['16px', "16pt"],
					['17px', "17pt"],
					['18px', "18pt"]
				],
				value: user.font_size || '13px',
				onChange: '$P().updateExampleText()'
			}),
			caption: 'Choose your desired font size for reading and composing posts.'
		});
		
		// Honor Single Line Breaks
		// html += this.getFormRow({
		// 	label: 'Line Breaks:',
		// 	content: this.getFormCheckbox({
		// 		id: 'fe_ms_line_breaks',
		// 		checked: !!user.line_breaks,
		// 		label: "Show Single Line Breaks"
		// 	}),
		// 	caption: 'Some e-mails have hard line breaks in them, usually at around 80 characters.  When this box is checked, they will be honored and displayed in their original format.  When unchecked, e-mail text will be reformatted and adjacent lines joined together.'
		// });
		
		// Show Inline Images
		html += this.getFormRow({
			label: 'Images:',
			content: this.getFormCheckbox({
				id: 'fe_ms_inline_images',
				checked: !!user.inline_images,
				label: "Show Inline Images"
			}),
			caption: 'When checked, image URLs found in e-mails will be expanded, and the images displayed inline.  This is only applicable in <b>Rich Text</b> mode. If you are on limited bandwidth you might want to disable this feature.'
		});
		
		// Profanity
		html += this.getFormRow({
			label: 'Profanity:',
			content: this.getFormCheckbox({
				id: 'fe_ms_profanity',
				checked: !!user.profanity_filter,
				label: "Censor Bad Words"
			}),
			caption: 'Are you offended by seeing bad words?  If so, simply check this box, and we will do our best to censor all profanity from all messages across the site (English language only).'
		});
		
		html += this.getFormRow({
			label: 'Filters:',
			content: this.getFormCheckbox({
				id: 'fe_ms_enable_filters',
				checked: !!user.enable_filters,
				label: "Enable Filters &amp; Blocks"
			}),
			caption: 'This checkbox controls whether the category filters and blocked senders are enabled or not (see below).  Uncheck this box if you want to temporarily see all the bad content that you\'re missing.'
		});
		
		// Filters (Negative Tags)
		html += this.getFormRow({
			label: 'Filter Categories:',
			content: this.getFormMenuMulti({
				id: 'fe_ms_filters',
				title: 'Select Categories to Filter',
				placeholder: 'Select categories to filter out...',
				options: app.tags,
				values: user.exclude_tags
			}),
			caption: 'Optionally select categories to filter out (i.e. hide) from your view.'
		});
		
		// Blocked Senders
		html += this.getFormRow({
			label: 'Blocked Senders:',
			content: this.getFormMenuMulti({
				id: 'fe_ms_blocks',
				title: 'Add new blocked sender',
				placeholder: 'Click to add blocked sender...',
				icon: 'mdi-email-plus-outline',
				description: 'Enter any e-mail address, name, or partial match of either, and all senders matching your list will be hidden from view.',
				confirm: 'Add Block',
				options: user.exclude_froms,
				values: user.exclude_froms,
				trim: 1,
				lower: 1
			}),
			caption: 'Optionally add specific senders (names or e-mail addresses) to block from your view.'
		});
		
		// Email Signature
		html += this.getFormRow({
			label: 'Email Signature:',
			content: this.getFormTextarea({
				id: 'fe_ms_signature',
				rows: 5,
				value: user.signature || '',
				maxlength: 8192,
				onKeyDown: 'captureTabs(this,event)'
			}),
			caption: 'Optionally enter a personalized signature to append to the bottom of all your posts and replies.'
		});
		
		html += '</div>'; // box_content
		
		// buttons at bottom
		html += '<div class="box_buttons">';
			html += '<div class="button primary" onMouseUp="$P().saveChanges()"><i class="mdi mdi-floppy">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '</div>'; // box
				
		this.div.html( html );
		this.updateExampleText();
		
		MultiSelect.init( this.div.find('#fe_ms_filters') );
		TextSelect.init( this.div.find('#fe_ms_blocks') );
		
		this.div.find('#fe_ms_signature').val( user.signature );
	}
	
	updateExampleText() {
		// show example text in user's selected style
		this.div.find('#d_ms_example_text, #fe_ms_signature').css({
			fontFamily: this.div.find('#fe_ms_font_family').val(),
			fontSize: this.div.find('#fe_ms_font_size').val()
		});
	}
	
	get_settings_form_json() {
		// get all form settings into object for saving
		return {
			date_format: this.div.find('#fe_ms_date_fmt').val(),
			text_format: this.div.find('#fe_ms_text_fmt').val(),
			font_family: this.div.find('#fe_ms_font_family').val(),
			font_size: this.div.find('#fe_ms_font_size').val(),
			// line_breaks: !!this.div.find('#fe_ms_line_breaks').is(':checked'),
			inline_images: !!this.div.find('#fe_ms_inline_images').is(':checked'),
			profanity_filter: !!this.div.find('#fe_ms_profanity').is(':checked'),
			enable_filters: !!this.div.find('#fe_ms_enable_filters').is(':checked'),
			exclude_tags: this.div.find('#fe_ms_filters').val(),
			exclude_froms: this.div.find('#fe_ms_blocks').val(),
			signature: this.div.find('#fe_ms_signature').val()
		};
	}
	
	is_dirty() {
		// return true if user made changes, false otherwise
		var user = app.user;
		if (!user) return false; // sanity
		if (!this.div.find('#fe_ms_date_fmt').length) return false;
		
		var json = this.get_settings_form_json();
		if (json.date_format != user.date_format) return true;
		if (json.text_format != user.text_format) return true;
		if (json.font_family != user.font_family) return true;
		if (json.font_size != user.font_size) return true;
		// if (json.line_breaks != user.line_breaks) return true;
		if (json.inline_images != user.inline_images) return true;
		if (json.profanity_filter != user.profanity_filter) return true;
		if (json.enable_filters != user.enable_filters) return true;
		if (json.signature != user.signature) return true;
		if (json.exclude_tags.join(',') != user.exclude_tags.join(',')) return true;
		if (json.exclude_froms.join(',') != user.exclude_froms.join(',')) return true;
		
		return false;
	}
	
	saveChanges() {
		// save changes to user info
		app.clearError();
		Dialog.showProgress( 1.0, "Saving preferences..." );
		
		var json = this.get_settings_form_json();
		
		app.api.post( 'app/user_settings', json, function(resp) {
			// save complete
			Dialog.hideProgress();
			app.clearPageAnchorCache();
			app.showMessage('success', "Your settings were saved successfully.");
			
			app.user = resp.user;
			app.prepUser();
			app.initSidebarTabs();
		} );
	}
	
	onDeactivate() {
		// called when page is deactivated
		
		// auto-save in background if user made changes
		if (this.is_dirty()) {
			var json = this.get_settings_form_json();
			merge_hash_into( app.user, json );
			app.prepUser();
			app.initSidebarTabs();
			app.clearPageAnchorCache();
			
			app.api.post( 'app/user_settings', json, function(resp) {
				app.showMessage('success', "Your settings were saved successfully.");
			}); // api.post
		}
		
		this.div.html( '' );
		return true;
	}
	
};
