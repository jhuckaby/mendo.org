Page.Favorites = class Favorites extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		if (!this.requireLogin(args)) return true;
		
		if (!args) args = {};
		this.args = args;
		
		app.setWindowTitle('My Favorites');
		app.setHeaderTitle( '<i class="mdi mdi-heart-multiple">&nbsp;</i>My Favorites' );
		app.showSidebar(true);
		
		// resume if coming back
		// var anchor = Nav.currentAnchor();
		// if (anchor == this.lastAnchor) {
		// 	$(document).scrollTop( this.lastScrollY );
		// 	return true;
		// }
		// this.lastAnchor = anchor;
		
		var html = '';
		
		html += this.getMiniPageHeader({
			title: 'All Favorites',
			subtitle: '(Newest on top)',
			widget: '<span class="link" onMouseUp="$P().doDownload()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i>Download All...</span>'
		});
		
		html += '<div id="d_favs"><div class="loading_container"><div class="loading"></div></div></div>';
		this.div.html( html );
		
		// compose search query
		this.records = [];
		this.opts = {
			query: [
				'favorites:' + app.username
			].join(' ').trim(),
			offset: args.offset || 0,
			limit: config.items_per_page
		};
		app.api.get( 'app/search', this.opts, this.receiveFavs.bind(this) );
		
		return true;
	}
	
	receiveFavs(resp) {
		// receive search results from server
		var self = this;
		var html = '';
		var $recent = this.div.find('#d_favs');
		
		$recent.find('.loading_container').remove();
		$recent.find('.load_more').remove();
		
		if (resp.total) {
			resp.records.forEach( function(record) {
				var idx = self.records.length;
				self.prepDisplayRecord(record, idx);
				self.records.push(record);
				
				html += '<div class="message_container" data-idx="' + idx + '">';
					html += '<div class="box ' + (record.boxClass || '') + '">';
						html += '<div class="box_title subject"><a href="#View?id=' + (record.parent || record.id) + '">' + record.disp.subject + '</a>';
							html += record.disp.admin;
							html += '<div>';
								html += '<div class="box_subtitle from">' + record.disp.from + '</div>';
								html += '<div class="box_subtitle date">' + record.disp.date + '</div>';
							html += '</div>';
						html += '</div>';
						html += '<div class="message_body">' + record.disp.body + '</div>';
						if (record.type == 'topic') {
							html += '<div class="message_footer">' + record.disp.foot_widgets.join('') + '<div class="clear"></div>' + '</div>';
						}
						else {
							html += '<div class="message_footer" style="height:0"></div>';
						}
					html += '</div>'; // box
				html += '</div>'; // message_container
			}); // forEach
		}
		if (!this.records.length) {
			html += '<div class="box"><div class="box_content"><div class="inline_page_message">No favorites found.  Click the <i class="mdi mdi-heart-outline">&nbsp;</i> icon on your favorite messages to add them!</div></div></div>';
		}
		if (resp.total && (this.opts.offset + resp.records.length < resp.total)) {
			html += '<div class="load_more"><div class="button center" onMouseUp="$P().loadMoreFavs()"><i class="mdi mdi-arrow-down-circle-outline">&nbsp;</i>Load More...</div></div>';
		}
		
		$recent.append( html );
		this.expandInlineImages();
	}
	
	refresh() {
		// refresh search results from the top
		this.div.find('#d_favs').html( '<div class="loading_container"><div class="loading"></div></div>' );
		this.opts.offset = 0;
		app.api.get( 'app/search', this.opts, this.receiveFavs.bind(this) );
	}
	
	loadMoreFavs() {
		// load more search results, append to list
		this.div.find('.load_more').html( '<div class="loading"></div>' );
		this.opts.offset += config.items_per_page;
		app.api.get( 'app/search', this.opts, this.receiveFavs.bind(this) );
	}
	
	doDownload() {
		// download all favs as Mbox archive
		var self = this;
		var squery = 'favorites:' + app.username;
		
		// determine a nice default filename
		var filename = 'Favorites.mbox';
		
		var html = '';
		html += '<div class="dialog_help" style="margin-bottom:0">Use this feature to download an <a href="https://en.wikipedia.org/wiki/Mbox" target="_blank">Mbox archive</a> of all your favorites.  You can then import the Mbox archive into your favorite e-mail application.</div>';
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
		Dialog.confirm( 'Download Favorites', html, 'Download', function(result) {
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
		// this.div.html( '' );
		this.lastScrollY = $(document).scrollTop();
		return true;
	}
	
};
