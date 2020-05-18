Page.EditPost = class EditPost extends Page.NewTopic {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle( 'Edit Post' );
		app.setHeaderTitle( '<i class="mdi mdi-file-document-edit-outline">&nbsp;</i>Edit Post' );
		app.showSidebar(true);
		
		if (!app.user.verified) {
			// app.api.post( 'app/send_email_verification', {}, function(resp) {} );
			this.fullPageError({
				title: "Please Verify Your E-mail Address",
				description: "Sorry, but to edit posts you must first verify your e-mail address.  Please click the link in the e-mail sent to you." 
			});
			return true;
		}
		
		var html = '';
		html += '<div id="d_view"><div class="loading_container"><div class="loading"></div></div></div>';
		this.div.html( html );
		
		this.record = null;
		
		app.api.get( 'app/view', { id: args.id }, this.receiveData.bind(this), this.fullPageError.bind(this) );
		return true;
	}
	
	receiveData(resp) {
		// receive data from server
		var self = this;
		var html = '';
		var record = this.record = resp.data;
		
		if (resp.code) {
			app.doError("Message not found (perhaps it was deleted)");
			html += '<div class="inline_page_message">No message to display.</div>';
			this.div.find('#d_view').html( html );
			return;
		}
		
		var title = (record.type == 'topic') ? "Edit Topic" : "Edit Reply";
		app.setWindowTitle( title );
		app.setHeaderTitle( '<i class="mdi mdi-file-document-edit-outline">&nbsp;</i>' + title );
		
		html += '<div class="box">';
		// html += '<div class="box_title"></div>';
		html += '<div class="box_content" style="padding-bottom:0;">';
		
		// subject line
		html += '<div class="subject">' + this.getFormText({
			id: 'fe_post_subject',
			spellcheck: 'false',
			maxlength: 255,
			value: record.subject,
			placeholder: 'Enter subject line here...',
			style: 'width:100%; margin-bottom:20px; padding-top:6px; padding-bottom:6px; font-family:' + app.user.font_family, // family only, not size
			onKeyUp: '$P().lazySaveComposeText()'
		}) + '</div>';
		
		this.hasToolbar = false;
		if (app.user.text_format == 'markdown') {
			html += this.getEditToolbar('fe_post_body');
			this.hasToolbar = true;
		}
		
		// post body
		html += '<div class="reply">' + this.getFormTextarea({
			id: 'fe_post_body',
			value: record.body,
			maxlength: 65535,
			placeholder: 'Enter body text here...',
			style: 'width:100%; padding:10px; ' + this.getUserFontStyle(),
			onKeyDown: 'captureTabs(this,event)',
			onKeyUp: '$P().lazySaveComposeText()'
		}) + '</div>';
		
		html += '<div style="">'; // faux form_row (no grid)
		html += '<div class="left" style="font-size: 14px; padding: 15px 20px 20px 0px;">';
		
		// html += '<div>' + this.getFormCheckbox({
		// 		id: 'fe_send_listserv',
		// 		auto: 'reply_listserv', // remember state
		// 		label: "Also send post to the Announce ListServ"
		// 	}) + '</div>';
		
		html += '</div>';
		
		// buttons at bottom
		html += '<div class="box_buttons right" style="padding-right:0;">';
			html += '<div class="button" onMouseUp="$P().cancelConfirm()"><i class="mdi mdi-cancel">&nbsp;</i>Cancel</div>';
			html += '<div class="button" onMouseUp="$P().attachFiles()"><i class="mdi mdi-link-variant-plus">&nbsp;</i>Attach Files...</div>';
			html += '<div class="button primary" onMouseUp="$P().saveChanges()"><i class="mdi mdi-email-send-outline">&nbsp;</i>Save Changes</div>';
		html += '</div>'; // box_buttons
		
		html += '<div class="clear"></div>';
		
		html += '</div>'; // form_row
		
		html += '</div>'; // box_content
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.div.find('#fe_post_body').focus();
		
		// setup upload system
		ZeroUpload.setURL( '/api/app/upload_files' );
		ZeroUpload.setMaxFiles( 10 );
		ZeroUpload.setMaxBytes( 10 * 1024 * 1024 ); // 10 MB
		ZeroUpload.setFileTypes();
		ZeroUpload.on('start', this.uploadStart.bind(this) );
		ZeroUpload.on('progress', this.uploadProgress.bind(this) );
		ZeroUpload.on('complete', this.uploadComplete.bind(this) );
		ZeroUpload.on('error', this.uploadError.bind(this) );
		ZeroUpload.init();
		
		ZeroUpload.addDropTarget( "#fe_post_body", {
			session_id: app.getPref('session_id')
		} );
		
		delete localStorage.savePost;
		
		this.onResize( get_inner_window_size() );
		return true;
	}
	
	cancelPost() {
		// really cancel edit
		delete localStorage.savePost;
		Nav.go( 'View?id=' + this.args.id );
	}
	
	getPreviewRecord() {
		// get mock record object suitable for preview
		var record = {
			type: this.record.type,
			date: time_now(),
			body: this.div.find('#fe_post_body').val(),
			subject: this.div.find('#fe_post_subject').val(),
			from: app.user.full_name + ' <' + app.user.email + '>',
			admin: app.isAdmin()
		};
		this.prepDisplayRecord(record);
		return record;
	}
	
	saveChanges() {
		// update message on server
		var self = this;
		app.clearError();
		
		var data = {
			id: this.args.id,
			subject: this.div.find('#fe_post_subject').val(),
			body: this.div.find('#fe_post_body').val()
		};
		
		if (!data.subject) return app.badField('#fe_post_subject', "Your post must have a subject line.");
		if (!data.body) return app.badField('#fe_post_body', "Your post must have some body text.");
		
		Dialog.showProgress( 1.0, "Saving changes..." );
		
		app.api.post( 'app/update_post', data, function(resp) {
			Dialog.hideProgress();
			app.cacheBust = hires_time_now();
			app.clearPageAnchorCache();
			
			delete localStorage.savePost;
			
			// show success message
			app.showMessage('success', "Your post was saved successfully!  It may take a few minutes for people to see the changes.");
			
			// clear text fields
			self.div.find('#fe_post_subject').val('');
			self.div.find('#fe_post_body').val('');
			
			// nav to topic thread
			Nav.go( '#View?id=' + self.args.id );
			
		} ); // api.post
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.editHidePreview();
		ZeroUpload.removeDropTarget( "#fe_post_body" );
		this.div.html( '' );
		return true;
	}
	
};
