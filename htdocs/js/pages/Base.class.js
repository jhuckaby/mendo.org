// Base class for our pages to inherit from

Page.Base = class Base extends Page {
	
	getNiceAPIKey(item, link) {
		// overriding method in orchestra-theme page.js
		if (!item) return 'n/a';
		var key = item.api_key || item.key;
		var title = item.api_title || item.title;
		
		// this is the override here:
		if ((link === true) && !item.id) link = false;
		
		var html = '';
		var icon = '<i class="mdi mdi-key">&nbsp;</i>';
		if (link) {
			if (link === true) link = '#APIKeys?sub=edit&id=' + item.id;
			html += '<a href="' + link + '" style="text-decoration:none">';
			html += icon + '<span style="text-decoration:underline">' + title + '</span></a>';
		}
		else {
			html += icon + title;
		}
		
		return html;
	}
	
	getNiceTagList(tags, link, glue) {
		// get formatted tag group
		var self = this;
		if (!glue) glue = ',&nbsp;&nbsp;';
		if (!tags) return '&mdash;'
		if (typeof(tags) == 'string') tags = tags.split(/\,\s*/);
		return tags.map( function(tag) { return self.getNiceTag(tag, link); } ).join(glue);
	}
	
	getNiceTag(tag, link) {
		// get formatted tag with icon, plus optional link
		if (!tag) return '(None)';
		if (typeof(tag) == 'string') {
			var tag_def = find_object( app.tags, { id: tag } );
			if (tag_def) tag = tag_def;
			else {
				// deleted tag, no link
				tag = { id: tag, title: tag };
				link = false;
			}
		}
		
		var html = '';
		var icon = '<i class="mdi mdi-' + (tag.icon || 'tag') + '">&nbsp;</i>';
		if (link) {
			if (link === true) {
				link = '#Tag?id=' + tag.id;
				if (tag.id == 'events') link = '#Calendar';
			}
			html += '<a href="' + link + '" style="text-decoration:none">';
			html += icon + '<span style="text-decoration:underline">' + tag.title + '</span></a>';
		}
		else {
			html += icon + tag.title;
		}
		
		return html;
	}
	
	getNiceLocationList(locations, link, glue) {
		// get formatted location group
		var self = this;
		if (!glue) glue = ', ';
		if (typeof(locations) == 'string') locations = locations.split(/\,\s*/);
		return locations.map( function(loc) { return self.getNiceLocation(loc, link); } ).join(glue);
	}
	
	getNiceLocation(loc, link) {
		// get formatted location with icon, plus optional link
		if (!loc) return '(None)';
		if (typeof(loc) == 'string') {
			var loc_def = find_object( app.locations, { id: loc } );
			if (loc_def) loc = loc_def;
			else loc = { id: loc, title: loc };
		}
		
		var html = '';
		var icon = '<i class="mdi mdi-map-marker">&nbsp;</i>';
		if (link) {
			if (link === true) link = '#Location?id=' + loc.id;
			html += '<a href="' + link + '" style="text-decoration:none">';
			html += icon + '<span style="text-decoration:underline">' + loc.title + '</span></a>';
		}
		else {
			html += icon + loc.title;
		}
		
		return html;
	}
	
	getNiceFrom(from) {
		// format e-mail from and linkify
		if (from.match(/([\w\.\-]+\@[\w\.\-]+)/)) {
			var email = RegExp.$1;
			from = from.replace(/([\w\.\-]+\@[\w\.\-]+)/, '').replace(/[\<\>\(\)]+/g, '').trim();
			if (!from.match(/\S/)) from = email;
			from = '<a href="mailto:' + email + '">' + this.filterProfanity(from, "*") + '</a>';
		}
		else {
			from = this.filterProfanity(from, "*");
		}
		return '<i class="mdi mdi-account">&nbsp;</i>' + from;
	}
	
	getNiceFromText(from) {
		// format e-mail from in plain text
		if (from.match(/([\w\.\-]+\@[\w\.\-]+)/)) {
			var email = RegExp.$1;
			from = from.replace(/([\w\.\-]+\@[\w\.\-]+)/, '').replace(/[\<\>\(\)]+/g, '').trim();
			if (!from.match(/\S/)) from = email;
		}
		return from;
	}
	
	getNiceDateTime(epoch) {
		// format date according to user's prefs, add icon
		return '<i class="mdi mdi-calendar-clock">&nbsp;</i>' + this.getNiceDateTimeText(epoch);
	}
	
	getNiceDateTimeText(epoch) {
		// format date according to user's prefs, plain text
		return format_date(epoch, app.user.date_format || 'ERROR (User has no date_format set)');
	}
	
	selfNav(args) {
		// construct nav URI to current page, but with new args
		return '#' + this.ID + compose_query_string(args);
	}
	
	selfMergeNav(args) {
		// costruct nav URI to current page, but with new args merged in with current args
		return this.selfNav(merge_objects(this.args, args));
	}
	
	expandInlineImages(elem) {
		// expand all inline image URLs on page
		// this only works in markdown mode
		var self = this;
		if (!app.user.inline_images) return;
		if (app.user.text_format != 'markdown') return;
		if (!elem) elem = this.div;
		
		elem.find('div.message_body p a').each( function() {
			var $this = $(this);
			var href = $this.attr('href') || '';
			if (!href.match(/\.(jpg|jpeg|gif|png)(\?|$)/i)) return; // supported images only
			if ($this.data('expanded')) return; // do not re-expand an expanded link
			if ($this.next().length) return; // only process links at the end of parent blocks
			
			$this.after('<br/><img src="' + href + '" class="inline_image" onMouseUp="window.open(this.src)">');
			$this.data('expanded', true);
		});
	}
	
	getUserFontStyle() {
		// get style attributes for user font family and size settings
		if (!app.user) return 'font-size: 14px;';
		return 'font-family:' + app.user.font_family + '; font-size:' + app.user.font_size + ';'
	}
	
	getNiceSubject(subject, icon) {
		// format subject for display
		if (!icon) icon = 'email-outline';
		
		if ((subject.length > 3) && (subject == subject.toUpperCase())) {
			// convert all-upper-case subjects to title case
			subject = subject.toLowerCase().replace( /(^|\W+)([a-z])/g, function(m_all, m_g1, m_g2) {
				return m_g1 + m_g2.toUpperCase();
			} );
		}
		
		// profanity filter (user setting)
		subject = this.filterProfanity(subject, "*");
		
		return '<i class="mdi mdi-' + icon + '">&nbsp;</i>' + encode_entities(subject);
	}
	
	filterProfanity(text, str) {
		// if configured, censor text using replacement string for each character
		if (app.user.profanity_filter) {
			text = text.replace( app.badWordMatch, function(m_all, m_g1) {
				return (str).repeat( m_all.length );
			});
		}
		return text;
	}
	
	prepDisplayRecord(record, idx) {
		// prepare record bits for display
		if (typeof(idx) == 'undefined') idx = false;
		
		record.disp = {
			subject: this.getNiceSubject(record.subject, (idx === false) ? 'email-open-outline' : 'email-outline'),
			from: this.getNiceFrom(record.from),
			date: this.getNiceDateTime(record.date),
			body: '',
			admin: ''
		};
		
		if (record.type == 'reply') {
			if (!record.subject.match(/^re\:/i)) record.subject = 'Re: ' + record.subject;
			record.disp.subject = this.getNiceSubject(record.subject, 'reply');
		}
		
		var body = record.body;
		
		if (app.user.text_format == 'markdown') {
			// markdown
			var renderer = new marked.Renderer();
			renderer.code = function(code) { return '<p style="white-space:pre-wrap;">' + code + '</p>'; };
			
			// convert {{ curly-brace-style }} quotes to markdown syntax
			body = body.replace(/(^|\n)\{\{([\S\s]+?)\}\}(\n|$)/g, "$1> $2$3");
			
			// profanity filter (user setting)
			body = this.filterProfanity(body, "\\*");
			
			record.disp.body = '<div class="markdown-body" style="' + this.getUserFontStyle() + '">' + marked(body, {
				gfm: true,
				tables: true,
				breaks: app.user.line_breaks,
				pedantic: false,
				sanitize: false,
				smartLists: true,
				smartypants: false,
				silent: true,
				headerIds: false,
				mangle: false,
				renderer: renderer
			}) + '</div>';
		}
		else if (app.user.line_breaks) {
			// plain text (preserve line breaks)
			body = this.filterProfanity(body, "*");
			record.disp.body = 
				'<div class="plain-body-prewrap" style="' + this.getUserFontStyle() + '">' + 
					encode_entities(body) + 
				'</div>';
		}
		else {
			// plain text
			body = this.filterProfanity(body, "*");
			record.disp.body = 
				'<div class="plain-body" style="' + this.getUserFontStyle() + '">' + 
					encode_entities(body).replace(/\n\n/g, "<br/><br/>") + 
				'</div>';
		}
		
		var html = '';
		// html += '<div class="box_admin_button" onMouseUp="$P().editRecordAll(' + idx + ',this)"><i class="mdi mdi-menu"></i></div>';
		html += '<div class="box_admin_container">';
		
		// fav
		html += '<div class="box_admin_icon_widget" title="Favorite" onMouseUp="$P().editRecordFavorite(' + idx + ',this)">';
		if (record.fav) html += '<i class="mdi mdi-heart favorite"></i></div>';
		else html += '<i class="mdi mdi-heart-outline"></i></div>';
		
		// block
		html += '<div class="box_admin_icon_widget" title="Block Content" onMouseUp="$P().editRecordBlock(' + idx + ',this)"><i class="mdi mdi-cancel"></i></div>';
		
		// reply
		html += '<div class="box_admin_icon_widget" title="Reply" onMouseUp="$P().editRecordReply(' + idx + ',this)"><i class="mdi mdi-reply-all"></i></div>';
		
		if (app.isAdmin()) {
			html += '<div class="box_admin_spacer admin"></div>';
			
			if (record.type == 'topic') {
				html += '<div class="box_admin_icon_widget admin" title="(Admin) Edit Categories..." onMouseUp="$P().editRecordTags(' + idx + ',this)"><i class="mdi mdi-tag-multiple"></i></div>';
				html += '<div class="box_admin_icon_widget admin" title="(Admin) Edit Calendar..." onMouseUp="$P().editRecordCalendar(' + idx + ',this)"><i class="mdi mdi-calendar"></i></div>';
			}
			html += '<div class="box_admin_icon_widget admin" title="(Admin) Edit Message Type..." onMouseUp="$P().editRecordType(' + idx + ',this)"><i class="mdi mdi-tools"></i></div>';
			html += '<div class="box_admin_icon_widget admin" title="(Admin) Delete Message..." onMouseUp="$P().editRecordDelete(' + idx + ',this)"><i class="mdi mdi-trash-can-outline"></i></div>';
		} // isAdmin
		
		html += '<div class="clear"></div>';
		html += '</div>';
		record.disp.admin = html;
		
		// footer widgets (topics only)
		record.disp.foot_widgets = [];
		
		if (record.type == 'topic') {
			var foot_widgets = [];
			if (record.replies > 1) {
				if (this.ID == 'View') foot_widgets.push(record.replies + ' Replies<span class="num_hidden"></span>');
				else foot_widgets.push('<a href="#View?id=' + record.id + '" style="font-weight:bold">' + record.replies + ' Replies</a>');
			}
			else if (record.replies == 1) {
				if (this.ID == 'View') foot_widgets.push('1 Reply<span class="num_hidden"></span>');
				else foot_widgets.push('<a href="#View?id=' + record.id + '" style="font-weight:bold">1 Reply</a>');
			}
			else {
				foot_widgets.push('No Replies');
			}
			
			var tags = (record.tags || 'unsorted').split(/\,\s*/);
			if (tags.includes('events') && record.when) {
				// special handling for events
				var dates = record.when.split(/\,\s*/);
				var nice_start_date = format_date( dates[0], '[mmm] [mday]' );
				var nice_end_date = format_date( dates[dates.length - 1], '[mmm] [mday]' );
				var nice_date_range = '<i class="mdi mdi-calendar-blank">&nbsp;</i>' + nice_start_date;
				if (nice_end_date != nice_start_date) nice_date_range += ' - ' + nice_end_date;
				var yyyy_mm = format_date( dates[0], '[yyyy]/[mm]' );
				
				foot_widgets.push(
					'<span class="mfw_cal"><a href="#Calendar?date=' + yyyy_mm + '">' + nice_date_range + '</a></span>'
				);
				tags.splice( tags.indexOf('events'), 1 );
			}
			foot_widgets.push(
				'<span class="mfw_tags">' + this.getNiceTagList(tags.join(','), true) + '</span>'
			);
			
			if (record.locations) {
				foot_widgets.push( this.getNiceLocationList(record.locations, true) );
			}
			foot_widgets = foot_widgets.map( function(widget, idx) {
				return '<div class="message_footer_widget ' + ((idx == foot_widgets.length - 1) ? 'last' : '') + '">' + widget + '</div>';
			});
			
			if (idx === false) {
				foot_widgets.push( '<div class="message_footer_widget mfw_download last" style="float:right"><span class="link" onMouseUp="$P().doDownloadThread()"><i class="mdi mdi-cloud-download-outline">&nbsp;</i>Download Thread...</span></div>' );
			}
			
			if (app.isAdmin()) {
				if (idx !== false) foot_widgets.push( '<div class="message_footer_widget mfw_id last" style="float:right"><b>ID:</b>&nbsp;<span class="link nd" onMouseUp="copyToClipboard(this.innerText)" title="Copy ID to Clipboard">' + record.id + '</span></div>' );
				foot_widgets.push( '<div class="message_footer_widget mfw_suggest dirty" style="float:right; display:none"></div>' );
			} // admin
			
			record.disp.foot_widgets = foot_widgets;
		} // topics
	}
	
	getRecordFromIdx(idx) {
		// locate record from page, could be either main single record, reply, or from search results
		if (idx === false) return this.record;
		if (this.records) return this.records[idx];
		else if (this.replies) return this.replies[idx];
		return null;
	}
	
	editRecordTags(idx, elem) {
		// admin edit record tags
		var self = this;
		var record = this.getRecordFromIdx(idx);
		var $elem = $(elem);
		var html = '';
		var old_tags = (record.tags || 'unsorted').split(/\W+/);
		
		html += '<div class="sel_dialog_label">Select Categories for Message</div>';
		html += '<div class="sel_dialog_search_container">';
			html += '<input type="text" id="fe_sel_dialog_search" class="sel_dialog_search" value=""/>';
			html += '<div class="sel_dialog_search_icon"><i class="mdi mdi-magnify"></i></div>';
		html += '</div>';
		html += '<div id="d_sel_dialog_scrollarea" class="sel_dialog_scrollarea">';
		for (var idy = 0, ley = app.tags.length; idy < ley; idy++) {
			var tag = app.tags[idy];
			var sel = old_tags.includes(tag.id);
			html += '<div class="sel_dialog_item check ' + (sel ? 'selected' : '') + '" data-value="' + tag.id + '">';
			html += '<span>' + tag.title + '</span>';
			html += '<div class="sel_dialog_item_check"><i class="mdi mdi-check"></i></div>';
			html += '</div>';
		}
		html += '</div>';
		
		Popover.attach( $elem.closest('.box_title'), '<div style="padding:15px;">' + html + '</div>', true );
		
		$elem.closest('div.box').addClass('highlight');
		Popover.onDetach = function() {
			$elem.closest('div.box').removeClass('highlight');
		};
		
		$('#d_sel_dialog_scrollarea > div.sel_dialog_item').on('mouseup', function() {
			// toggle item, close dialog and update record
			var $item = $(this);
			// var value = $item.data('value');
			
			if ($item.hasClass('selected')) $item.removeClass('selected');
			else $item.addClass('selected');
			
			var new_tags = $('#d_sel_dialog_scrollarea div.sel_dialog_item.selected')
				.map( function() { return $(this).data('value'); } ).get();
			
			// reconcile 'unsorted' being an exclusive tag
			if ((new_tags.length > 1) && new_tags.includes('unsorted')) {
				if (old_tags.includes('unsorted')) new_tags.splice( new_tags.indexOf('unsorted'), 1 );
				else new_tags = ['unsorted'];
			}
			
			Popover.detach();
			
			if (new_tags.length > 3) {
				return app.doError("Topics should only have 3 categories max.  Please remove one before adding more.");
			}
			
			// update record, then update UI
			record.tags = new_tags.join(',');
			
			app.api.post( 'app/update_message', { id: record.id, tags: record.tags }, function(resp) {
				app.cacheBust = hires_time_now();
				app.clearPageAnchorCache();
				
				// redraw message footer (if topic)
				if (record.type == 'topic') {
					self.prepDisplayRecord(record, idx);
					$elem.closest('div.box').find('div.message_footer').html( 
						record.disp.foot_widgets.join('') + '<div class="clear"></div>' 
					);
				}
				
				// remove suggestions
				if (app.isAdmin()) {
					$elem.closest('div.box').find('div.message_footer div.message_footer_widget.mfw_suggest').empty();
				}
				
				// change load more to refresh, as pagination has changed
				if ((self.ID != 'View') || (idx !== false)) {
					self.div.find('div.load_more').html( '<div class="button center" onMouseUp="$P().refresh()"><i class="mdi mdi-cached">&nbsp;</i>Refresh...</div>' );
				}
				
				app.showMessage('success', "Message categories updated successfully.");
			} );
		}); // mouseup
		
		var $input = $('#fe_sel_dialog_search');
		$input.focus();
		
		// setup keyboard handlers
		$input.on('keyup', function(event) {
			// refresh list on every keypress
			var value = $input.val().toLowerCase();
			$('#d_sel_dialog_scrollarea > div.sel_dialog_item').each( function() {
				var $item = $(this);
				var text = $item.find('> span').html().toLowerCase();
				if (!value.length || (text.indexOf(value) > -1)) {
					$item.addClass('match').show();
				}
				else {
					$item.removeClass('match').hide();
				}
			} );
			Popover.reposition();
		});
		$input.on('keydown', function(event) {
			// capture enter key
			var value = $input.val().toLowerCase();
			if ((event.keyCode == 13) && value.length) {
				event.preventDefault();
				$('#d_sel_dialog_scrollarea > div.sel_dialog_item.match').slice(0, 1).trigger('mouseup');
			}
		});
	}
	
	editRecordReply(idx, elem) {
		// nav to view page and activate reply on load
		var record = this.getRecordFromIdx(idx);
		Nav.go( 'View?id=' + record.id + '&reply=1' );
	}
	
	editRecordFavorite(idx, elem) {
		// toggle favorite
		var self = this;
		var record = this.getRecordFromIdx(idx);
		record.fav = !record.fav; // toggle local state
		
		// debounce
		var now = hires_time_now();
		if (app.lastFav && ((now - app.lastFav) < 0.5)) return;
		app.lastFav = now;
		
		app.api.post( 'app/user_favorite', { id: record.id, fav: record.fav }, function(resp) {
			app.cacheBust = hires_time_now();
			if (elem) $(elem).html( record.fav ? 
				'<i class="mdi mdi-heart favorite"></i>' : 
				'<i class="mdi mdi-heart-outline"></i>' 
			);
			app.showMessage('success', "The message has been " + (record.fav ? 'added to' : 'removed from') + " your favorites.");
			
			// If we're on the Favorites screen, hide message for unfav
			if ((self.ID == 'Favorites') && !record.fav) {
				if (elem) $(elem).closest('div.message_container').hide();
				
				// change load more to refresh, as pagination has changed
				self.div.find('div.load_more').html( '<div class="button center" onMouseUp="$P().refresh()"><i class="mdi mdi-cached">&nbsp;</i>Refresh...</div>' );
			}
		} ); // api.post
	}
	
	editRecordBlock(idx, elem) {
		// add sender or categories to user's exclude lists
		var self = this;
		var record = this.getRecordFromIdx(idx);
		var email = record.from.match(/([\w\.\-]+\@[\w\.\-]+)/) ? RegExp.$1 : record.from;
		
		var html = '';
		html += '<div class="dialog_help" style="margin-bottom:0;">Please select which content you want to block.  You can choose to block all e-mails from this sender, and/or hide the entire categories in which the message is tagged.  Edit your selections later on the <b>Preferences</b> page.</div>';
		html += '<div class="box_content" style="padding-bottom:15px; max-width:600px;">';
		
		html += this.getFormRow({
			class: 'single',
			label: '',
			content: this.getFormCheckbox({
				id: 'fe_erb_block',
				checked: true,
				// checked: !!app.user.exclude_froms.includes(email),
				label: '<span style="">Block sender &ldquo;<b>' + encode_entities(email) + '</b>&rdquo;</span>'
			})
		});
		
		var tags = record.tags ? record.tags.split(/\,\s*/) : [];
		tags.forEach( function(tag) {
			html += self.getFormRow({
				class: 'single',
				label: '',
				content: self.getFormCheckbox({
					id: 'fe_erb_filter_' + tag,
					checked: !!app.user.exclude_tags.includes(tag),
					label: 'Filter entire category: <span class="nowrap"><b>' + self.getNiceTag(tag) + '</b></span>'
				})
			});
		}); // foreach tag
		
		html += '</div>';
		Dialog.confirm( '<span style="color:red">Block Content</span>', html, 'Save Changes', function(result) {
			if (!result) return;
			
			// add or remove sender block
			var checked = $('#fe_erb_block').is(':checked');
			if (checked && !app.user.exclude_froms.includes(email)) {
				app.user.exclude_froms.push( email );
			}
			else if (!checked && app.user.exclude_froms.includes(email)) {
				app.user.exclude_froms.splice( app.user.exclude_froms.indexOf(email), 1 );
			}
			
			// add or remove tag filters
			tags.forEach( function(tag) {
				var checked = $('#fe_erb_filter_' + tag).is(':checked');
				if (checked && !app.user.exclude_tags.includes(tag)) {
					app.user.exclude_tags.push( tag );
				}
				else if (!checked && app.user.exclude_tags.includes(tag)) {
					app.user.exclude_tags.splice( app.user.exclude_tags.indexOf(tag), 1 );
				}
			}); // foreach tag
			
			Dialog.showProgress( 1.0, "Saving preferences..." );
			
			app.api.post( 'app/user_settings', {
				exclude_froms: app.user.exclude_froms,
				exclude_tags: app.user.exclude_tags
			}, 
			function(resp) {
				// save complete
				Dialog.hideProgress();
				app.showMessage('success', "Your blocking / filtering changes have been saved.");
				app.user = resp.user;
				app.prepUser();
				
				// do not reapply filters on favorites page
				if (self.ID == 'Favorites') return;
				
				// dynamically refresh page (topic or reply layout)
				// (this is a no-op on the favorites screen)
				var records = self.records || self.replies || [];
				var $conts = self.div.find('div.message_container');
				var num_conts = $conts.length;
				var num_hidden = 0;
				
				$conts.each( function() {
					var $this = $(this);
					var idx = parseInt( $this.data('idx') );
					var record = records[idx];
					if (!self.userFilterRecord(record)) { $this.hide(); num_hidden++; }
				}); // each
				
				if ((idx !== false) && (num_hidden == num_conts)) {
					// user filtered ALL messages on current page -- refresh
					delete self.lastAnchor;
					Nav.refresh();
				}
				
				// Note: Blocking does NOT affect pagination (client-side filter)
				// So there is no need to do the load more --> refresh button
				
			} ); // api resp
		}); // Dialog.confirm
		
		$(elem).closest('div.box').addClass('highlight');
		Dialog.onHide = function() {
			$(elem).closest('div.box').removeClass('highlight');
		};
	}
	
	editRecordDelete(idx, elem) {
		// permanently delete a message (admin only)
		var self = this;
		var record = this.getRecordFromIdx(idx);
		
		// confirm first
		var msg = '';
		var title = '';
		if (record.type == 'topic') {
			title = "Delete Topic";
			msg = "Are you sure you want to permanently delete the topic &ldquo;<b>" + encode_entities(record.subject) + "</b>&rdquo;?  This affects all users, and you cannot undo this action.";
		}
		else {
			title = "Delete Reply";
			msg = "Are you sure you want to permanently delete the reply from &ldquo;<b>" + encode_entities(record.from) + "</b>&rdquo;?  This affects all users, and you cannot undo this action.";
		}
		
		Dialog.confirm( '<span style="color:red">' + title + '</span>', msg, 'Delete', function(result) {
			if (result) {
				Dialog.showProgress( 1.0, "Deleting message..." );
				
				app.api.post( 'app/delete_message', {
					id: record.id
				}, 
				function(resp) {
					// delete complete
					Dialog.hideProgress();
					app.showMessage('success', "The message was deleted successfully.");
					app.cacheBust = hires_time_now();
					app.clearPageAnchorCache();
					
					// dynamically refresh page
					if (idx === false) {
						// deleted single message in view
						$(elem).closest('div.box').html('<div class="inline_page_message">(This message has been deleted.)</div>');
					}
					else {
						// topic list or reply list
						$(elem).closest('div.message_container').hide();
						
						// change load more to refresh, as pagination has changed
						if (self.ID != 'View') {
							self.div.find('div.load_more').html( '<div class="button center" onMouseUp="$P().refresh()"><i class="mdi mdi-cached">&nbsp;</i>Refresh...</div>' );
						}
					}
				} ); // api resp
			} // confirmed
		} ); // Dialog.confirm
		
		$(elem).closest('div.box').addClass('highlight');
		Dialog.onHide = function() {
			$(elem).closest('div.box').removeClass('highlight');
		};
	}
	
	editRecordType(idx, elem) {
		// admin change record type (topic / reply)
		var self = this;
		var record = this.getRecordFromIdx(idx);
		var html = '<div class="box_content" style="padding-bottom:15px;">';
		
		html += this.getFormRow({
			label: 'Change Type:',
			content: this.getFormMenu({
				id: 'fe_ert_type',
				options: [ ['topic', 'Topic'], ['reply', 'Reply'] ],
				value: record.type
			}),
			caption: 'Select the appropriate record type for the message.'
		});
		
		html += this.getFormRow({
			id: 'd_ert_parent',
			label: 'Parent ID:',
			content: this.getFormText({
				id: 'fe_ert_parent',
				spellcheck: 'false',
				maxlength: 32,
				value: record.parent || ''
			}),
			caption: 'Enter the ID of the topic to attach this reply to.'
		});
		
		html += '</div>';
		Dialog.confirm( 'Change Message Type', html, 'Save Changes', function(result) {
			if (!result) return;
			
			var new_type = $('#fe_ert_type').val();
			var parent_id = $('#fe_ert_parent').val().toLowerCase().trim();
			
			if ((new_type == 'reply') && !parent_id) {
				return app.badField('#fe_ert_parent', "Please enter the ID of the parent topic to attach this reply to.");
			}
			if ((new_type == 'reply') && !parent_id.match(/^\w+$/)) {
				return app.badField('#fe_ert_parent', "You have entered an invalid parent topic ID.  Please use only alphanumerics.");
			}
			Dialog.hide();
			
			if (new_type == record.type) return; // no change
			
			var updates = {
				id: record.id,
				type: new_type
			};
			
			// update record, then update UI
			record.type = new_type;
			if (new_type == 'reply') {
				// changing to reply
				updates.parent = parent_id;
				updates.tags = '';
				updates.locations = '';
				updates.replies = 0;
				updates.when = '';
			}
			else {
				// changing to topic
				updates.parent = '';
				if (!record.tags) updates.tags = 'unsorted';
			}
			
			Dialog.showProgress( 1.0, "Changing message type..." );
			
			app.api.post( 'app/update_message', updates, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "The message type was updated successfully.");
				app.cacheBust = hires_time_now();
				app.clearPageAnchorCache();
				
				// do not update pages that show mixed message types
				if (self.ID == 'Favorites') return;
				if (self.ID == 'Search') return;
				
				// dynamically refresh page
				if (idx === false) {
					// deleted single message in view
					$(elem).closest('div.box').html('<div class="inline_page_message">(This message has been moved.)</div>');
				}
				else {
					// topic list or reply list
					$(elem).closest('div.message_container').hide();
					
					// change load more to refresh, as pagination has changed
					if (self.ID != 'View') {
						self.div.find('div.load_more').html( '<div class="button center" onMouseUp="$P().refresh()"><i class="mdi mdi-cached">&nbsp;</i>Refresh...</div>' );
					}
				}
			} ); // api.post
		} ); // Dialog.confirm
		
		if (record.type != 'reply') $('#d_ert_parent').hide();
		
		$('#fe_ert_type').on('change', function() {
			var new_type = $(this).val();
			if (new_type != 'reply') $('#d_ert_parent').hide();
			else {
				$('#d_ert_parent').show();
				$('#fe_ert_parent').focus();
			}
		});
		
		$(elem).closest('div.box').addClass('highlight');
		Dialog.onHide = function() {
			$(elem).closest('div.box').removeClass('highlight');
		};
	}
	
	editRecordCalendar(idx, elem) {
		// toggle record's calendar appearance and edit dates
		var self = this;
		var record = this.getRecordFromIdx(idx);
		var $elem = $(elem);
		if (!record.tags) record.tags = '';
		var html = '<div class="box_content" style="padding-bottom:15px; max-width:600px;">';
		
		var start_epoch = time_now();
		var end_epoch = start_epoch;
		if (record.when) {
			var dates = record.when.split(/\,\s*/);
			start_epoch = get_date_args( dates[0] ).epoch;
			end_epoch = get_date_args( dates[dates.length - 1] ).epoch;
		}
		
		html += this.getFormRow({
			label: 'Event:',
			content: this.getFormCheckbox({
				id: 'fe_erc_event',
				checked: !!record.tags.match(/\bevents\b/),
				label: "Add to Calendar"
			}),
			caption: 'When checked, this topic will appear as an event on the calendar, for the selected date range below.'
		});
		
		html += this.getFormRow({
			label: 'Start Date:',
			content: this.getFormDate({
				id: 'fe_erc_start',
				value: start_epoch
			}),
			caption: 'Select the start date for the event.'
		});
		
		html += this.getFormRow({
			label: 'End Date:',
			content: this.getFormDate({
				id: 'fe_erc_end',
				value: end_epoch
			}),
			suffix: '<div class="form_suffix_icon mdi mdi-clipboard-arrow-left-outline" title="Copy from start date" onMouseUp="$P().calendarCopyStartEnd()" onMouseDown="event.preventDefault();"></div>',
			caption: 'Select the end date for the event (set this to the start date for a single day).'
		});
		
		html += '</div>';
		Dialog.confirm( 'Edit Calendar', html, 'Save Changes', function(result) {
			if (!result) return;
			
			var has_event_tag = !!$('#fe_erc_event').is(':checked');
			start_epoch = has_event_tag ? parseInt( $('#fe_erc_start').val() ) : 0;
			end_epoch = has_event_tag ? parseInt( $('#fe_erc_end').val() ) : 0;
			
			if (has_event_tag) {
				// add event to calendar
				if (end_epoch < start_epoch) return app.doError("The event end date cannot come before the start date.");
				if (end_epoch > start_epoch + (86400 * 32)) return app.doError("Event date ranges cannot span longer than a month.");
				
				record.tags = self.recordAddTagCSV( record.tags, 'events' );
				record.when = self.recordGetDateRangeCSV( start_epoch, end_epoch );
				
				// unsorted is exclusive
				if (record.tags.match(/\bunsorted\b/)) {
					record.tags = self.recordRemoveTagCSV( record.tags, 'unsorted' );
				}
			}
			else {
				// remove event from calendar
				record.tags = self.recordRemoveTagCSV( record.tags, 'events' ) || 'unsorted';
				// record.when = '';
			}
			
			Dialog.hide();
			Dialog.showProgress( 1.0, "Saving calendar..." );
			
			app.api.post( 'app/update_message', { id: record.id, tags: record.tags, when: record.when }, function(resp) {
				Dialog.hideProgress();
				app.showMessage('success', "The calendar was updated successfully.");
				app.cacheBust = hires_time_now();
				app.clearPageAnchorCache();
				
				// redraw message footer (if topic)
				self.prepDisplayRecord(record, idx);
				$elem.closest('div.box').find('div.message_footer').html(
					record.disp.foot_widgets.join('') + '<div class="clear"></div>' 
				);
				
				if ((self.ID != 'View') || (idx !== false)) {
					// change load more to refresh, as pagination has changed
					self.div.find('div.load_more').html( '<div class="button center" onMouseUp="$P().refresh()"><i class="mdi mdi-cached">&nbsp;</i>Refresh...</div>' );
				}
				
				// remove suggestions
				if (app.isAdmin()) {
					$elem.closest('div.box').find('div.message_footer div.message_footer_widget.mfw_suggest').empty();
				}
			} ); // api.post
		}); // Dialog.confirm
		
		Calendar.init('#fe_erc_start, #fe_erc_end');
		Dialog.autoResize();
		
		$(elem).closest('div.box').addClass('highlight');
		Dialog.onHide = function() {
			$(elem).closest('div.box').removeClass('highlight');
		};
		
		$('#fe_erc_start, #fe_erc_end').on('change', function() {
			$('#fe_erc_event').prop('checked', true);
		});
	}
	
	calendarCopyStartEnd() {
		// copy start date to end date in calendar dialog
		$('#fe_erc_end').val( $('#fe_erc_start').val() );
		$('#fe_erc_end').trigger('change');
	}
	
	userFilterRecord(record) {
		// apply user filters to record, hide if necessary
		// return false == hide
		var result = true;
		
		if (record.type == 'topic') {
			var tags = record.tags || 'unsorted';
			if (tags.match(app.userExcludeTagMatch)) result = false;
		}
		if (record.from && record.from.match(app.userExcludeFromMatch)) result = false;
		
		if (!result && !app.user.enable_filters) {
			// special user-activated setting to disable filters
			// shows filtered results but highlights them in red
			record.boxClass = 'red';
			result = true;
		}
		
		if (!result && this.args && ("filter" in this.args) && (this.args.filter == 0)) {
			// special filter=0 mode, shows filtered results but highlights them in red
			record.boxClass = 'red';
			result = true;
		}
		
		return result;
	}
	
	userFilterSearchQuery(query) {
		// apply user filters to search query
		if (app.user.exclude_tags && app.user.exclude_tags.length) {
			query += ' tags:' + app.user.exclude_tags.map( function(tag) { return '-' + tag; } ).join(' ');
		}
		if (app.user.exclude_froms && app.user.exclude_froms.length) {
			query += ' from:' + app.user.exclude_froms.map( function(from) { return '-"' + from + '"'; } ).join(' ');
		}
		return query;
	}
	
	setExpandedView(expanded) {
		// set expanded / compact view, and save prefs
		if (expanded) {
			$('body').removeClass('compact');
			app.setPref('expand_views', true);
		}
		else {
			$('body').addClass('compact');
			app.setPref('expand_views', false);
		}
	}
	
	getMiniPageHeader(args) {
		// return standard header box used by tags / locations pages
		// (no date nav, no sort label)
		var html = '';
		
		var size_widget = args.widget || '';
		if (!size_widget) {
			size_widget += '<span class="compact_view_link" onMouseUp="$P().setExpandedView(0)">Compact</span>';
			size_widget += '&nbsp;&nbsp;|&nbsp;&nbsp;';
			size_widget += '<span class="expanded_view_link" onMouseUp="$P().setExpandedView(1)">Expanded</span>';
		}
		
		html += '<div class="box" style="border:none;">';
			html += '<div class="box_title_trip">';
				html += '<div class="box_title" style="grid-area:a; padding:0">' + args.title + '</div>';
				html += '<div class="box_subtitle mobile_hide" style="grid-area:b; text-align:center; color:var(--label-color)"><i>' + args.subtitle + '</i></div>';
				html += '<div class="box_subtitle" style="grid-area:c; text-align:right">' + size_widget + '</div>';
			html += '</div>'; // quad
		html += '</div>'; // box
		
		return html;
	}
	
	getStandardPageHeader(args) {
		// return standard header box used by several pages
		var html = '';
		
		var size_widget = args.widget || '';
		if (!size_widget) {
			size_widget += '<span class="compact_view_link" onMouseUp="$P().setExpandedView(0)">Compact</span>';
			size_widget += '&nbsp;&nbsp;|&nbsp;&nbsp;';
			size_widget += '<span class="expanded_view_link" onMouseUp="$P().setExpandedView(1)">Expanded</span>';
		}
		
		var nav_widget = '';
		nav_widget += '<a href="' + this.selfNav({ date: this.getPrevMonth() }) + '">&laquo; <b>Prev <span class="mobile_hide">Month</span></b></a>';
		if (args.future || (args.date < get_date_args().yyyy_mm)) {
			nav_widget += '&nbsp;&nbsp;|&nbsp;&nbsp;<a href="' + this.selfNav({ date: this.getNextMonth() }) + '"><b>Next <span class="mobile_hide">Month</span></b> &raquo;</a>';
		}
		
		html += '<div class="box" style="border:none;">';
			
			html += '<div class="box_title_quad">';
				// one
				html += '<div class="box_title" style="grid-area:a; padding:0">' + args.title + '</div>';
				
				// two
				html += '<div class="box_subtitle" style="grid-area:b; text-align:center; color:var(--label-color)"><i>' + args.subtitle + '</i></div>';
				
				// three
				html += '<div class="box_subtitle" style="grid-area:c; text-align:center;">' + size_widget + '</div>';
				
				// four
				html += '<div class="box_subtitle" style="grid-area:d; text-align:right">' + nav_widget + '</div>';
			html += '</div>'; // quad
			
		html += '</div>'; // box
		
		return html;
	}
	
	getPrevMonth() {
		// return yyyy/mm of prev month
		var parts = this.args.date.split('/').map( function(part) { return parseInt(part); } );
		var year = parts[0];
		var mon = parts[1];
		mon--; if (mon < 1) { mon = 12; year--; }
		if (mon < 10) mon = '0' + mon;
		return year + '/' + mon;
	}
	
	getNextMonth() {
		// return yyyy/mm of next month
		var parts = this.args.date.split('/').map( function(part) { return parseInt(part); } );
		var year = parts[0];
		var mon = parts[1];
		mon++; if (mon > 12) { mon = 1; year++; }
		if (mon < 10) mon = '0' + mon;
		return year + '/' + mon;
	}
	
	updateSuggestions() {
		// look for visible dirty ML suggestion widgets, and populate them
		var self = this;
		if (!app.isAdmin()) return;
		
		this.div.find('div.mfw_suggest.dirty').each( function() {
			var $this = $(this);
			var $cont = $this.closest('.message_container');
			var idx = parseInt( $cont.data('idx') );
			var record = self.records[idx];
			
			if (record.tags && (record.tags != 'unsorted')) {
				$this.removeClass('dirty').empty().hide();
				return;
			}
			if (!$this.parent().visible(true, true)) return;
			
			app.api.post( 'app/ml_suggest', { id: record.id }, function(resp) {
				var tags = resp.tags || [];
				record.suggest = tags;
				
				var html = '<b>Suggested:</b>&nbsp;<span class="link nd" onMouseUp="$P().applySuggestions(this)" title="Apply all suggestions">' + 
					(tags.length ? self.getNiceTagList(tags, false) : '(None)') + '</span>';
				
				$this.html(html).removeClass('dirty').show();
			}, 
			function(err) {
				$this.empty().hide();
			} );
		});
	}
	
	applySuggestions(elem) {
		// apply all ML suggestions
		// Note: This is always called on list results, never the main record (i.e. #View)
		var self = this;
		var $elem = $(elem);
		var $cont = $elem.closest('.message_container');
		var idx = parseInt( $cont.data('idx') );
		var record = this.records[idx];
		if (!record.suggest || !record.suggest.length) return; // sanity
		
		// update record, then update UI
		record.tags = record.suggest.join(', ');
		
		app.api.post( 'app/update_message', { id: record.id, tags: record.tags }, function(resp) {
			app.cacheBust = hires_time_now();
			app.clearPageAnchorCache();
			
			// redraw tags in message footer
			$elem.closest('div.box').find('div.message_footer span.mfw_tags').html(
				self.getNiceTagList(record.tags || 'unsorted', true)
			);
			
			// change load more to refresh, as pagination has changed
			if ((self.ID != 'View') || (idx !== false)) {
				self.div.find('div.load_more').html( '<div class="button center" onMouseUp="$P().refresh()"><i class="mdi mdi-cached">&nbsp;</i>Refresh...</div>' );
			}
			
			app.showMessage('success', "Message categories updated successfully.");
		} );
	}
	
	// Utilities for working with CSV lists in database records
	
	recordAddTagCSV(tags_csv, tag) {
		// add a tag to a CSV list, preventing dupes, preserving order
		// return the new CSV list
		var tags = tags_csv ? tags_csv.split(/\,\s*/) : [];
		if (!tags.includes(tag)) tags.push(tag);
		return tags.join(', ');
	}
	
	recordRemoveTagCSV(tags_csv, tag) {
		// remove a tag from a CSV list, preventing dupes, preserving order
		// return the new CSV list
		var tags = tags_csv ? tags_csv.split(/\,\s*/) : [];
		var idx = tags.indexOf(tag);
		if (idx > -1) tags.splice(idx, 1);
		return tags.join(', ');
	}
	
	recordGetDateRangeCSV(start, end) {
		// get a CSV list of YYYY/MM/DD dates given a start + end epoch
		var dates = [];
		var epochs = [start, end];
		epochs.sort();
		
		var start_epoch = epochs.shift();
		dates.push( get_date_args(start_epoch).yyyy_mm_dd );
		
		if (epochs.length) {
			// more than one date, we have a range
			var end_epoch = epochs.pop();
			var epoch = start_epoch + 43200; // 12 hours, making sure we don't hop a day due to DST
			
			while (epoch <= end_epoch) {
				var yyyy_mm_dd = get_date_args(epoch).yyyy_mm_dd;
				if (yyyy_mm_dd != dates[dates.length - 1]) {
					dates.push( yyyy_mm_dd );
				}
				epoch += 43200; 
			} // while
		} // multi-date
		
		return dates.join(', ');
	}
	
	// Editor Toolbar
	
	getEditToolbar(id) {
		// return HTML for editor toolbar buttons and help link
		var html = '';
		this.editorID = id;
		
		html += '<div class="editor_toolbar">';
			html += '<div class="editor_toolbar_button" title="Header 1" onMouseUp="$P().editInsertHeader(1)"><i class="mdi mdi-format-header-1"></i></div>';
			html += '<div class="editor_toolbar_button" title="Header 2" onMouseUp="$P().editInsertHeader(2)"><i class="mdi mdi-format-header-2"></i></div>';
			html += '<div class="editor_toolbar_button" title="Header 3" onMouseUp="$P().editInsertHeader(3)"><i class="mdi mdi-format-header-3"></i></div>';
			// html += '<div class="editor_toolbar_button" title="Header 4" onMouseUp="$P().editInsertH4()"><i class="mdi mdi-format-header-4"></i></div>';
			
			html += '<div class="editor_toolbar_divider"></div>';
			
			html += '<div class="editor_toolbar_button" title="Bold" onMouseUp="$P().editToggleBold()"><i class="mdi mdi-format-bold"></i></div>';
			html += '<div class="editor_toolbar_button" title="Italic" onMouseUp="$P().editToggleItalic()"><i class="mdi mdi-format-italic"></i></div>';
			html += '<div class="editor_toolbar_button" title="Strikethrough" onMouseUp="$P().editToggleStrike()"><i class="mdi mdi-format-strikethrough"></i></div>';
			
			html += '<div class="editor_toolbar_divider"></div>';
			
			html += '<div class="editor_toolbar_button" title="Insert Bullet List" onMouseUp="$P().editInsertList()"><i class="mdi mdi-format-list-bulleted-square"></i></div>';
			html += '<div class="editor_toolbar_button" title="Insert Numbered List" onMouseUp="$P().editInsertNumList()"><i class="mdi mdi-format-list-numbered"></i></div>';
			html += '<div class="editor_toolbar_button" title="Insert Blockquote" onMouseUp="$P().editInsertQuote()"><i class="mdi mdi-format-quote-open"></i></div>';
			
			html += '<div class="editor_toolbar_divider"></div>';
			
			html += '<div class="editor_toolbar_button" id="btn_show_preview" title="Show Preview" onMouseUp="$P().editShowPreview()"><i class="mdi mdi-file-find-outline"></i></div>';
			
			html += '<div class="editor_toolbar_help"><a href="#Document?id=markdown" target="_blank">What\'s this?</a></div>';
			
			html += '<div class="clear"></div>';
		html += '</div>';
		
		return html;
	}
	
	editorSurroundText(chars) {
		// surround selection with chars, or remove them
		var $input = this.div.find('#' + this.editorID);
		var input = $input.get(0);
		
		input.focus();
		
		var before = input.value.substring(0, input.selectionStart);
		var selection = input.value.substring(input.selectionStart, input.selectionEnd);
		var after = input.value.substring(input.selectionEnd);
		
		var endsWith = new RegExp( escape_regexp(chars) + '$' );
		var startsWith = new RegExp( '^' + escape_regexp(chars) );
		
		if (before.match(endsWith) && after.match(startsWith)) {
			// remove bold
			before = before.replace(endsWith, '');
			after = after.replace(startsWith, '');
		}
		else {
			// add bold
			before += chars;
			after = chars + after;
		}
		
		input.value = before + selection + after;
		input.setRangeText(selection, before.length, before.length + selection.length, "select");
		
		$input.trigger('keyup'); // lazy save
	}
	
	editorInsertBlockElem(text) {
		// insert block level element, like # or - or >
		var $input = this.div.find('#' + this.editorID);
		var input = $input.get(0);
		
		input.focus();
		
		var before = input.value.substring(0, input.selectionStart);
		var selection = input.value.substring(input.selectionStart, input.selectionEnd);
		var after = input.value.substring(input.selectionEnd);
		
		if (!before.match(/\n\n$/)) {
			if (before.match(/\n$/)) before += "\n";
			else if (before.length) before += "\n\n";
		}
		if (!after.match(/^\n\n/)) {
			if (after.match(/^\n/)) after = "\n" + after;
			else if (after.length) after = "\n\n" + after;
			else after = "\n" + after;
		}
		
		text += selection;
		
		input.value = before + text + after;
		input.setRangeText(text, before.length, before.length + text.length, "end");
		
		$input.trigger('keyup'); // lazy save
	}
	
	editToggleBold() {
		this.editorSurroundText('**');
	}
	
	editToggleItalic() {
		this.editorSurroundText('*');
	}
	
	editToggleStrike() {
		this.editorSurroundText('~~');
	}
	
	editToggleCode() {
		this.editorSurroundText('`');
	}
	
	editInsertHeader(level) {
		var prefix = '';
		for (var idx = 0; idx < level; idx++) prefix += '#';
		this.editorInsertBlockElem(prefix + ' ');
	}
	
	editInsertList() {
		this.editorInsertBlockElem('- ');
	}
	
	editInsertNumList() {
		this.editorInsertBlockElem('1. ');
	}
	
	editInsertQuote() {
		this.editorInsertBlockElem('> ');
	}
	
	editShowPreview() {
		// show live markdown preview
		var self = this;
		var $input = this.div.find('#' + this.editorID);
		var record = this.getPreviewRecord();
		var html = '';
		
		// html += '<div class="box" style="margin:0">';
			html += '<div class="box_title subject">' + record.disp.subject + '';
				html += '<div>';
					html += '<div class="box_subtitle from">' + record.disp.from + '</div>';
					html += '<div class="box_subtitle date">' + record.disp.date + '</div>';
				html += '</div>';
			html += '</div>';
			html += '<div class="message_body">' + record.disp.body + '</div>';
			html += '<div class="message_footer" style="height:0"></div>';
		// html += '</div>'; // box
		
		var pos = $input.offset();
		var width = $input.width();
		var height = $input.height();
		
		var div = $('<div></div>').prop('id', 'd_post_preview').addClass('box').css({
			position: 'absolute',
			left: '' + pos.left + 'px',
			top: '' + pos.top + 'px',
			width: '' + width + 'px',
			height: '' + height + 'px',
			margin: '0',
			'overflow-x': 'hidden',
			'overflow-y': 'auto',
			zIndex: 1000
		}).html(html);
		
		$('body').append(div);
		$input.css('visibility', 'hidden');
		this.div.find('#btn_show_preview').addClass('selected');
		this.editPreviewActive = true;
		
		if ($('#popoverlay').length) {
			$('#popoverlay').stop().remove();
		}
		
		var $overlay = $('<div id="popoverlay"></div>').css('opacity', 0);
		$('body').append($overlay);
		$overlay.fadeTo( 500, 0.5 ).click(function() {
			self.editHidePreview();
		});
		
		unscroll();
		
		this.expandInlineImages( $('#d_post_preview') );
	}
	
	editRepositionPreview() {
		// reposition preview overlay on window resize
		if (this.editPreviewActive) {
			var $input = this.div.find('#' + this.editorID);
			var pos = $input.offset();
			var width = $input.width();
			var height = $input.height();
			
			$('#d_post_preview').css({
				left: '' + pos.left + 'px',
				top: '' + pos.top + 'px',
				width: '' + width + 'px',
				height: '' + height + 'px'
			});
		}
	}
	
	editHidePreview() {
		// hide editor live preview
		if (this.editPreviewActive) {
			delete this.editPreviewActive;
			
			$('#popoverlay').stop().fadeOut( 300, function() { $(this).remove(); } );
			unscroll.reset();
			
			$('#d_post_preview').remove();
			this.div.find('#btn_show_preview').removeClass('selected');
			
			var $input = this.div.find('#' + this.editorID);
			$input.css('visibility', 'visible');
			
			setTimeout( function() { $input.focus(); }, 250 );
		}
	}
	
};
