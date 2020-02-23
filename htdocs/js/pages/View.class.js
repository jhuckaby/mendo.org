Page.View = class PageView extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle('View Topic');
		app.setHeaderTitle( '<i class="mdi mdi-email-open-outline">&nbsp;</i>View Topic' );
		app.showSidebar(true);
		
		var html = '';
		html += '<div id="d_view"><div class="loading_container"><div class="loading"></div></div></div>';
		this.div.html( html );
		
		this.record = null;
		this.replies = [];
		
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
		
		app.api.get( 'app/view', { id: args.id }, this.receiveData.bind(this) );
		return true;
	}
	
	receiveData(resp) {
		// display message and replies, if any
		var self = this;
		var html = '';
		var record = this.record = resp.data;
		
		if (resp.code) {
			app.doError("Message not found (perhaps it was deleted)");
			html += '<div class="inline_page_message">No message to display.</div>';
			this.div.find('#d_view').html( html );
			return;
		}
		if (record.parent) {
			// For now, we cannot view a reply directly like this.
			// Redirect to parent record (i.e. thread, will show reply in list).
			Nav.go( this.selfNav({ id: record.parent }) );
			return;
		}
		
		this.prepDisplayRecord(record);
		
		html += '<div class="box">';
			html += '<div class="box_title subject">' + record.disp.subject;
				html += record.disp.admin;
				html += '<div class="box_subtitle from">' + record.disp.from + '</div>';
				html += '<div class="box_subtitle date">' + record.disp.date + '</div>';
			html += '</div>';
			html += '<div class="message_body">' + record.disp.body + '</div>';
			html += '<div class="message_footer">' + record.disp.foot_widgets.join('') + '<div class="clear"></div>' + '</div>';
		html += '</div>'; // box
		
		if (record.replies) {
			html += '<div id="d_replies"><div class="loading_container"><div class="loading"></div></div></div>';
		}
		else {
			html += '<div id="d_replies"></div>';
		}
		
		// reply editor (hidden until needed)
		html += '<div id="d_reply" style="display:none">';
			html += '<div class="box">';
			html += '<div class="box_title"></div>'; // will be dynamically populated
			html += '<div class="box_content" style="padding-top:0; padding-bottom:0;">';
			
			html += '<div class="reply">' + this.getFormTextarea({
				id: 'fe_reply_body',
				rows: 15,
				value: '',
				maxlength: 65535,
				style: 'width:100%; ' + this.getUserFontStyle(),
				onKeyDown: 'captureTabs(this,event)',
				onKeyUp: '$P().lazySaveReplyText()'
			}) + '</div>';
			
			html += '<div style="">'; // faux form_row (no grid)
			html += '<div class="left" style="font-size: 14px; padding: 15px 20px 20px 0px;">';
			
			html += '<div>' + this.getFormCheckbox({
					id: 'fe_reply_sender',
					auto: 'reply_sender', // remember state
					label: "Also send reply to the original poster"
				}) + '</div><div style="margin-top:2px;">' + this.getFormCheckbox({
					id: 'fe_reply_listserv',
					auto: 'reply_listserv', // remember state
					label: "Also send reply to the Announce ListServ"
				}) + '</div>';
			
			html += '</div>';
			
			// buttons at bottom
			html += '<div class="box_buttons right" style="padding-right:0;">';
				html += '<div class="button" onMouseUp="$P().cancelReplyConfirm()"><i class="mdi mdi-cancel">&nbsp;</i>Discard</div>';
				html += '<div class="button" onMouseUp="$P().attachFiles()"><i class="mdi mdi-link-variant-plus">&nbsp;</i>Attach Files...</div>';
				html += '<div class="button primary" onMouseUp="$P().sendReply()"><i class="mdi mdi-email-send-outline">&nbsp;</i>Send Reply</div>';
			html += '</div>'; // box_buttons
			
			html += '<div class="clear"></div>';
			
			html += '</div>'; // form_row
			
			html += '</div>'; // box_content
			
			html += '</div>'; // box
		html += '</div>'; // d_reply
		
		this.div.find('#d_view').html( html );
		if (!this.args.reply) this.expandInlineImages();
		
		ZeroUpload.addDropTarget( "#fe_reply_body", {
			session_id: app.getPref('session_id')
		} );
		
		if (!record.replies) {
			if (this.args.reply) this.editRecordReply(false, null);
			return;
		}
		
		// compose search query for replies
		this.opts = {
			query: [
				// 'type:reply',
				'parent:' + this.args.id
			].join(' ').trim(),
			offset: this.args.offset || 0,
			limit: config.items_per_page,
			sort_dir: 1 // ascending
		};
		app.api.get( 'app/search', this.opts, this.receiveReplies.bind(this) );
		
		// maybe show ml suggest widget
		if (app.isAdmin() && (!record.tags || (record.tags == 'unsorted'))) {
			app.api.get( 'app/ml_suggest', { id: record.id }, function(resp) {
				var tags = resp.tags || [];
				record.suggest = tags;
				
				var html = '<b>Suggested:</b>&nbsp;<span class="link nd" onMouseUp="$P().applySuggestions(this)" title="Apply all suggestions">' + 
					(tags.length ? self.getNiceTagList(tags, false) : '(None)') + '</span>';
				
				self.div.find('div.ml_suggest.dirty').html(html).removeClass('dirty').show();
			}, 
			function(err) {} );
		}
		
		return true;
	}
	
	applySuggestions(elem) {
		// apply all ML suggestions
		var self = this;
		var $elem = $(elem);
		var record = this.record;
		
		// update record, then update UI
		record.tags = record.suggest.join(', ');
		
		app.api.post( 'app/update_message', { id: record.id, tags: record.tags }, function(resp) {
			app.cacheBust = hires_time_now();
			app.clearPageAnchorCache();
			
			// redraw tags in message footer
			$elem.closest('div.box').find('div.message_footer span.mfw_tags').html(
				self.getNiceTagList(record.tags || 'unsorted', true)
			);
			
			app.showMessage('success', "Message categories updated successfully.");
		} );
	}
	
	receiveReplies(resp) {
		// render all replies
		var self = this;
		var html = '';
		var num_hidden = 0;
		var $replies = this.div.find('#d_replies');
		
		$replies.find('.loading_container').remove();
		$replies.find('.load_more').remove();
		
		if (resp.total) {
			resp.records.forEach( function(record) {
				if (!self.userFilterRecord(record)) { num_hidden++; return; }
				
				var idx = self.replies.length;
				self.prepDisplayRecord(record, idx);
				self.replies.push(record);
				
				html += '<div class="message_container mc_reply" data-idx="' + idx + '">';
					html += '<div class="rc_icon"><i class="mdi mdi-redo"></i></div>';
					
					html += '<div class="box ' + (record.boxClass || '') + '">';
						html += '<div class="box_title subject">';
							html += record.disp.admin;
							html += '<div class="box_subtitle from">' + record.disp.from + '</div>';
							html += '<div class="box_subtitle date">' + record.disp.date + '</div>';
						html += '</div>';
						html += '<div class="message_body">' + record.disp.body + '</div>';
					html += '</div>'; // box
				
				html += '</div>'; // reply container
			}); // forEach
			
			if (this.opts.offset + resp.records.length < resp.total) {
				html += '<div class="load_more"><div class="button center" onMouseUp="$P().loadMoreReplies()">Load More...</div></div>';
			}
		}
		
		$replies.append( html );
		
		if (num_hidden && !this.opts.offset) {
			this.div.find('#d_view > .box span.num_hidden').html( '&nbsp;(' + num_hidden + '&nbsp;hidden)' );
		}
		
		if (this.args.reply) this.editRecordReply(false, null);
		else this.expandInlineImages();
	}
	
	refresh() {
		// refresh replies from the top
		this.div.find('#d_replies').html( '<div class="loading_container"><div class="loading"></div></div>' );
		this.opts.offset = 0;
		app.api.get( 'app/search', this.opts, this.receiveReplies.bind(this) );
	}
	
	loadMoreReplies() {
		// load more search results, append to list
		this.div.find('.load_more').html( '<div class="loading"></div>' );
		this.opts.offset += config.items_per_page;
		app.api.get( 'app/search', this.opts, this.receiveReplies.bind(this) );
	}
	
	editRecordReply(idx, elem) {
		// show reply editor and scroll down to it
		var record = this.getRecordFromIdx(idx);
		var $reply = this.div.find('#d_reply');
		
		if (!app.user.verified) {
			app.api.post( 'app/send_email_verification', {}, function(resp) {} );
			return app.doError("Sorry, but to send replies you must first verify your e-mail address.  Please click the link in the e-mail sent to you.");
		}
		
		$reply.show();
		$(document).scrollTop( $reply.offset().top );
		
		var body = '';
		var saveReply = localStorage.saveReply ? JSON.parse(localStorage.saveReply) : {};
		if (saveReply.id && (saveReply.id == record.id)) {
			// restore saved draft
			body = saveReply.text;
		}
		else {
			// start new reply
			body = (app.user.signature || '') + 
				"\n\n" + 
				"On " + this.getNiceDateTimeText(record.date) + ", " + record.from + " wrote:\n" + 
				record.body.trim().split(/\n/).map( function(line) { return "> " + line; } ).join("\n") + "\n";
			
			delete localStorage.saveReply;
		}
		
		$reply.find('.box_title').html( '<i class="mdi mdi-reply-all">&nbsp;</i>Reply to ' + this.getNiceFromText(record.from) );
		$reply.find('#fe_reply_body').val( body ).focus();
		
		// place caret at beginning of field
		$reply.find('#fe_reply_body').get(0).setSelectionRange(0, 0);
		
		delete this.args.reply;
		this.replyRecord = record;
	}
	
	lazySaveReplyText() {
		// delayed background draft save
		var self = this;
		if (this.lazySaveTimer) {
			clearTimeout( this.lazySaveTimer );
			delete this.lazySaveTimer;
		}
		this.lazySaveTimer = setTimeout( function() {
			delete self.lazySaveTimer;
			localStorage.saveReply = JSON.stringify({
				id: self.replyRecord.id,
				text: self.div.find('#fe_reply_body').val()
			});
		}, 1000 );
	}
	
	cancelReplyConfirm() {
		// cancel reply and remove draft save
		var self = this;
		if (!localStorage.saveReply) return this.cancelReply();
		
		var msg = "Are you sure you want to discard your draft?  This action cannot be undone.";
		
		Dialog.confirm( '<span style="color:red">Discard Draft</span>', msg, 'Discard', function(result) {
			if (!result) return;
			Dialog.hide();
			self.cancelReply();
		} );
	}
	
	cancelReply() {
		// really cancel reply
		delete localStorage.saveReply;
		this.div.find('#fe_reply_body').val('');
		this.div.find('#d_reply').hide();
	}
	
	attachFiles() {
		// open file selection dialog
		ZeroUpload.chooseFiles({
			session_id: app.getPref('session_id')
		});
	}
	
	uploadStart(files, userData) {
		// avatar upload has started
		Dialog.showProgress( 0.0, "Uploading " + pluralize('file', files.length) + "..." );
		Debug.trace('upload', "Upload started");
	}
	
	uploadProgress(progress) {
		// avatar is on its way
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
		var input = this.div.find('#fe_reply_body').get(0);
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
	
	sendReply() {
		// send reply
		var self = this;
		app.clearError();
		
		var reply = {
			parent: this.args.id,
			body: this.div.find('#fe_reply_body').val(),
			send_to_listserv: !!this.div.find('#fe_reply_listserv').is(':checked'),
			send_to_sender: this.div.find('#fe_reply_sender').is(':checked') ? this.replyRecord.from : ''
		};
		
		if (!reply.body) return app.badField('#fe_reply_body', "Please enter some reply text before sending.");
		
		Dialog.showProgress( 1.0, "Sending reply..." );
		
		app.api.post( 'app/post_reply', reply, function(resp) {
			Dialog.hideProgress();
			app.cacheBust = hires_time_now();
			// app.clearPageAnchorCache();
			self.div.find('#d_reply').hide();
			
			delete localStorage.saveReply;
			
			// show success message
			app.showMessage('success', "Your reply was sent successfully.");
			
			// append faux reply
			var idx = self.replies.length;
			var record = resp.message;
			
			self.prepDisplayRecord(record, idx);
			self.replies.push(record);
			
			var html = '';
			html += '<div class="message_container mc_reply">';
				html += '<div class="rc_icon"><i class="mdi mdi-redo"></i></div>';
				
				html += '<div class="box flash">';
					html += '<div class="box_title subject">';
						html += '<div class="box_subtitle from">' + record.disp.from + '</div>';
						html += '<div class="box_subtitle date">' + record.disp.date + '</div>';
					html += '</div>';
					html += '<div class="message_body">' + record.disp.body + '</div>';
				html += '</div>'; // box
			
			html += '</div>'; // reply container
			
			var $replies = self.div.find('#d_replies');
			$replies.find('.load_more').remove();
			$replies.append(html);
			
			self.expandInlineImages();
		} ); // api.post
	}
	
	doDownloadThread() {
		// download entire thread as Mbox archive
		var self = this;
		var squery = 'parent:' + this.args.id;
		squery = this.userFilterSearchQuery(squery);
		
		// determine a nice default filename
		var filename = this.record.subject.replace(/\W+/g, '-');
		if (filename.length > 26) filename = filename.substring(0, 26);
		filename = filename.replace(/\-$/, '');
		filename += '.mbox';
		
		var html = '';
		html += '<div class="dialog_help" style="margin-bottom:0">Use this feature to download an <a href="https://en.wikipedia.org/wiki/Mbox" target="_blank">Mbox archive</a> of the message thread (including all replies).  You can then import the Mbox archive into your favorite e-mail application.</div>';
		html += '<div class="box_content" style="padding-bottom:15px;">';
		
		html += this.getFormRow({
			label: 'Filename:',
			content: this.getFormText({
				id: 'fe_mbox_filename',
				spellcheck: 'false',
				maxlength: 64,
				value: filename
			}),
			caption: 'Enter a filename for your Mbox archive.'
		});
		
		html += '</div>';
		Dialog.confirm( 'Download Thread', html, 'Download', function(result) {
			if (!result) return;
			filename = $('#fe_mbox_filename').val().trim().replace(/[^\w\-\.]+/g, '-');
			if (!filename || !filename.match(/\w/)) return app.badField('#fe_mbox_filename', "Please enter a valid filename for your Mbox archive.");
			if (!filename.match(/\.mbox$/i)) filename += '.mbox';
			Dialog.showProgress( 1.0, "Preparing download..." );
			
			// get download token first
			// (so we don't have to add the session ID onto the URL)
			app.api.post( 'app/get_download_token', {}, function(resp) {
				// got token
				var url = '/api/app/download_mbox' + compose_query_string({
					token: resp.token,
					username: app.username,
					query: squery,
					parent: self.args.id,
					filename: filename
				});
				window.location = url;
				
				setTimeout( function() {
					Dialog.hideProgress();
					app.showMessage('success', "Your download should begin momentarily.");
				}, 50 );
			} ); // api resp
		} ); // Dialog.confirm
		
		// pre-select the filename sans extension
		$('#fe_mbox_filename').focus().get(0).setSelectionRange(0, filename.length - 5);
	}
	
	onDeactivate() {
		// called when page is deactivated
		ZeroUpload.removeDropTarget( "#fe_reply_body" );
		this.div.html( '' );
		return true;
	}
	
};
