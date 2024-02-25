Page.NewTopic = class NewTopic extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle( 'Post New Topic' );
		app.setHeaderTitle( '<i class="mdi mdi-file-document-edit-outline">&nbsp;</i>Post New Topic' );
		app.showSidebar(true);
		
		if (!app.user.verified) {
			// app.api.post( 'app/send_email_verification', {}, function(resp) {} );
			this.fullPageError({
				title: "Please Verify Your E-mail Address",
				description: "Sorry, but to post new topics you must first verify your e-mail address.  Please click the link in the e-mail sent to you." 
			});
			return true;
		}
		
		var html = '';
		
		html += '<div class="box">';
		// html += '<div class="box_title"></div>';
		html += '<div class="box_content" style="padding-bottom:0;">';
		
		// subject line
		html += '<div class="subject">' + this.getFormText({
			id: 'fe_post_subject',
			spellcheck: 'false',
			maxlength: 255,
			value: '',
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
			value: '',
			maxlength: 65535,
			placeholder: 'Enter body text here...',
			style: 'width:100%; padding:10px; ' + this.getUserFontStyle(),
			onKeyDown: 'captureTabs(this,event)',
			onKeyUp: '$P().lazySaveComposeText()'
		}) + '</div>';
		
		html += '<div style="">'; // faux form_row (no grid)
		html += '<div class="left" style="font-size: 14px; padding: 15px 20px 20px 0px;">';
		
		html += '<div>' + this.getFormCheckbox({
				id: 'fe_send_listserv',
				auto: 'reply_listserv', // remember state
				label: "Also send post to the Announce ListServ"
			}) + '</div>';
		
		html += '</div>';
		
		// buttons at bottom
		html += '<div class="box_buttons right" style="padding-right:0;">';
			html += '<div class="button" onMouseUp="$P().cancelConfirm()"><i class="mdi mdi-cancel">&nbsp;</i>Discard</div>';
			html += '<div class="button" onMouseUp="$P().attachFiles()"><i class="mdi mdi-link-variant-plus">&nbsp;</i>Attach Files...</div>';
			html += '<div class="button primary" onMouseUp="$P().sendPost()"><i class="mdi mdi-email-send-outline">&nbsp;</i>Post Topic</div>';
		html += '</div>'; // box_buttons
		
		html += '<div class="clear"></div>';
		
		html += '</div>'; // form_row
		
		html += '</div>'; // box_content
		
		html += '</div>'; // box
		
		this.div.html( html );
		this.div.find('#fe_post_subject').focus();
		
		// setup upload system
		ZeroUpload.setURL( '/api/app/upload_files' );
		ZeroUpload.setMaxFiles( 10 );
		ZeroUpload.setMaxBytes( 100 * 1024 * 1024 ); // 100 MB
		ZeroUpload.setFileTypes();
		ZeroUpload.on('start', this.uploadStart.bind(this) );
		ZeroUpload.on('progress', this.uploadProgress.bind(this) );
		ZeroUpload.on('complete', this.uploadComplete.bind(this) );
		ZeroUpload.on('error', this.uploadError.bind(this) );
		ZeroUpload.init();
		
		ZeroUpload.addDropTarget( "#fe_post_body", {
			session_id: app.getPref('session_id')
		} );
		
		var savePost = localStorage.savePost ? JSON.parse(localStorage.savePost) : null;
		if (savePost) {
			// restore saved draft
			this.div.find('#fe_post_subject').val( savePost.subject );
			this.div.find('#fe_post_body').val( savePost.body );
		}
		else {
			// start new post
			delete localStorage.savePost;
			this.div.find('#fe_post_body').val( app.user.signature || '' );
		}
		
		this.onResize( get_inner_window_size() );
		return true;
	}
	
	onResize(dims) {
		// resize post body to fit
		var fudge = this.hasToolbar ? 310 : 280;
		this.div.find('#fe_post_body').css({
			height: '' + Math.floor( dims.height - fudge ) + 'px'
		});
		this.editRepositionPreview();
	}
	
	lazySaveComposeText() {
		// delayed background draft save
		var self = this;
		if (this.lazySaveTimer) {
			clearTimeout( this.lazySaveTimer );
			delete this.lazySaveTimer;
		}
		this.lazySaveTimer = setTimeout( function() {
			delete self.lazySaveTimer;
			var subject = self.div.find('#fe_post_subject').val();
			var body = self.div.find('#fe_post_body').val();
			
			if (subject.length || body.length) {
				localStorage.savePost = JSON.stringify({
					subject: subject,
					body: body
				});
			}
			else {
				delete localStorage.savePost;
			}
		}, 1000 );
	}
	
	cancelConfirm() {
		// cancel post and remove draft save
		var self = this;
		if (!localStorage.savePost) return this.cancelPost();
		
		var msg = "Are you sure you want to discard your draft?  This action cannot be undone.";
		
		Dialog.confirm( '<span style="color:red">Discard Draft</span>', msg, 'Discard', function(result) {
			if (!result) return;
			Dialog.hide();
			self.cancelPost();
		} );
	}
	
	cancelPost() {
		// really cancel post
		delete localStorage.savePost;
		this.div.find('#fe_post_subject').val('');
		this.div.find('#fe_post_body').val('');
	}
	
	attachFiles() {
		// open file selection dialog
		ZeroUpload.chooseFiles({
			session_id: app.getPref('session_id')
		});
	}
	
	uploadStart(files, userData) {
		// file upload has started
		Dialog.showProgress( 0.0, "Uploading " + pluralize('file', files.length) + "..." );
		Debug.trace('upload', "Upload started");
	}
	
	uploadProgress(progress) {
		// file is on its way
		Dialog.showProgress( progress.amount );
		Debug.trace('upload', "Upload progress: " + progress.pct);
	}
	
	uploadComplete(response, userData) {
		// file upload has completed
		Dialog.hideProgress();
		Debug.trace('upload', "Upload complete!", response.data);
		
		var data = null;
		try { data = JSON.parse( response.data ); }
		catch (err) {
			return app.doError("Upload Failed: JSON Parse Error: " + err);
		}
		
		if (data && (data.code != 0)) {
			return app.doError("Upload Failed: " + data.description);
		}
		
		var text = data.urls.join("\n\n");
		var input = this.div.find('#fe_post_body').get(0);
		input.focus();
		
		// make sure URLs are separated by double-EOLs between, and on each side
		var before = input.value.substring(0, input.selectionStart).replace(/\r\n/g, "\n");
		var after = input.value.substring(input.selectionEnd).replace(/\r\n/g, "\n");
		
		if (!before.match(/\n\n$/)) {
			if (before.match(/\n$/)) text = "\n" + text;
			else if (before.length) text = "\n\n" + text;
		}
		if (!after.match(/^\n\n/)) {
			if (after.match(/^\n/)) text += "\n";
			else if (after.length) text += "\n\n";
			else text += "\n";
		}
		
		input.setRangeText(text, input.selectionStart, input.selectionEnd, "end");
		
		app.showMessage('success', (data.urls.length > 1) ?
			"Your files were uploaded successfully, and links were placed into your post text." : 
			"Your file was uploaded successfully, and a link was placed into your post text."
		);
	}
	
	uploadError(type, message, userData) {
		// avatar upload error
		Dialog.hideProgress();
		app.doError("Upload Failed: " + message);
	}
	
	getPreviewRecord() {
		// get mock record object suitable for preview
		var record = {
			type: 'topic',
			date: time_now(),
			body: this.div.find('#fe_post_body').val(),
			subject: this.div.find('#fe_post_subject').val(),
			from: app.user.full_name + ' <' + app.user.email + '>',
			admin: app.isAdmin()
		};
		this.prepDisplayRecord(record);
		return record;
	}
	
	sendPost() {
		// post new topic
		var self = this;
		app.clearError();
		
		var data = {
			subject: this.div.find('#fe_post_subject').val(),
			body: this.div.find('#fe_post_body').val(),
			send_to_listserv: !!this.div.find('#fe_send_listserv').is(':checked')
		};
		
		if (!data.subject) return app.badField('#fe_post_subject', "Please enter a subject line before posting.");
		if (!data.body) return app.badField('#fe_post_body', "Please enter some body text before posting.");
		
		Dialog.showProgress( 1.0, "Posting new topic..." );
		
		app.api.post( 'app/post_topic', data, function(resp) {
			Dialog.hideProgress();
			app.cacheBust = hires_time_now();
			app.clearPageAnchorCache();
			
			delete localStorage.savePost;
			
			// show success message
			app.showMessage('success', "Your topic was posted successfully!  It may take a few minutes for people to see it.");
			
			// clear text fields
			self.div.find('#fe_post_subject').val('');
			self.div.find('#fe_post_body').val('');
			
			// nav to topic thread
			Nav.go( '#View?id=' + resp.id );
			
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
