## Search Help

To perform a search, enter one or more words into the text field above, and hit enter (or click the **Search** button).  Searches are not case-sensitive.  If you enter multiple words, they all must be found in the message for it to be included in the search results.  However, the words don't necessarily have to appear in order.  For example, consider this search query:

```
music festival
```

This would find any messages that contained both words (`music` and `festival`), but they do not have to appear next to together.  They each can be anywhere in the message.  If you want to match an exact phrase, surround it with "double-quotes", like this:

```
"music festival"
```

This would only show messages that contained the *exact phrase* in quotes, i.e. the two words in sequence.

### Categories and Locations

To narrow your search to specific categories or locations, select them from the drop-down menus under the search box.  You can select more than one category or location, and messages that match **any** of them will be included in the search results.

### From and Subject

By default, the message body, subject and from (sender name and address) are all searched.  If you want to limit your search to a particular field, prefix it like this:

```
from:symphony@mcn.org
```

This would only find messages sent from the address `symphony@mcn.org`.  You can also search names in many cases (people usually include a name with their from address).  To search only the subject line, prefix it with `subject:`.  Example:

```
subject:winter concert
```

This would only find messages that have the words `winter` and `concert` in the subject line specifically.  If you want to combine these field searches with a body text search, place them at the end, like so:

```
"Symphony of the Redwoods" subject:winter concert from:symphony@mcn.org
```

This would find messages that contain the exact phrase "Symphony of the Redwoods", with both `winter` and `concert` in the subject line, and were sent from the address `symphony@mcn.org`.

### Negative Matches

You can augment a search so that it *excludes* certain words or phrases.  To do this, prefix the negative words or phrases with a hyphen (`-`).  Example:

```
"Symphony of the Redwoods" -birds -cats -frogs
```

This would find messages that contain the exact phrase "Symphony of the Redwoods", but **not** the words `birds`, `cats` or `frogs`.  Note that negative words can only take away from an existing search result, so you need to start with some positive (normal matching) words.

### OR Matches

To find messages that contain any of a set of words (known as an "OR" match), separate them by pipe (`|`) characters.  Example:

```
symphony | concert | festival
```

This would find messages that contain **any** of the specified words.  Note that you cannot combine an OR and an AND search in the same search query, so it's either one or the other.

### Topics or Replies

By default, both topics and replies will be included in your search results.  To limit your search to one or the other message type, append `type:topic` or `type:reply` to only include topics or replies, respectively.  Example:

```
"Symphony of the Redwoods" type:topic
```

This would find messages that contain the exact phrase "Symphony of the Redwoods", but **only** show topics, not replies.

### Search Presets

Once you have your search working how you want it, you can "save" it to your account as a search preset.  Saved presets will appear in the sidebar under "**My Searches**", so you can get back to them with one single click, and see updated results.

To save a search query, click on the "**Save Preset**" button, and give it a name.  This is then saved to your user account, so it will still be there if you log out, and log back in later, or on a different device.

To edit a search preset, click on the preset from the sidebar, make any changes you want, then click the "**Edit Preset**" button, then the "**Save Changes**" button.  To delete a search preset, click on it from the sidebar, then click the "**Delete Preset**" button.

#### Search Alerts

When you click the "**Save Preset**" button to save the search preset, you are presented with a checkbox that says "*Notify me for new messages*".  If you check this box and save, then the search preset becomes a *search alert*.

Search alerts will notify you via e-mail when any new messages arrive on Mendo.org that match your search query.  So for example, let's say you created a search preset that searched for "Symphony of the Redwoods", and checked the "*Notify me for new messages*" checkbox.  Then, when anyone sent in any new messages that contained that phrase, Mendo.org will automatically forward the e-mail directly to you.

The forwarded e-mails for search alerts have a special "**(Mendo.org)**" prefix in the subject line, so you can easily identify them in your e-mail application.  The message body is also prefixed with a short introduction at the very top, explaining why the message was sent to you.  Example:

> (This message was forwarded to you by Mendo.org, because it matched your search alert "Super Bowl".)

Getting too many e-mails?  To disable a search alert, simply edit the search preset as you normally would (click it in the sidebar under "**My Searches**"), click "**Edit Preset**", uncheck the "*Notify me for new messages*" checkbox, and then click "**Save Changes**".

### Mbox Downloads

Mendo.org allows you to download any set of search results as a [Mbox mail archive](https://en.wikipedia.org/wiki/Mbox) file.  This is a special file format that can be imported into many popular e-mail applications, including Apple Mail and Mozilla Thunderbird.  Basically, this allows you to keep a local copy of any messages you want.

Simply click the "**Download All**" button to download the current search results as an Mbox file.  You will be prompted to enter a desired filename for the Mbox file, which should then arrive in your "Downloads" folder (or wherever your browser downloads files to).

Note that the download feature will include **all** messages in the search results, not just those that are currently displayed.  Meaning, your search query may match hundreds or thousands of messages, but only a handful will be displayed at a time.  But when you download, you will get **all** of them in one single Mbox file.

Here are links to tutorials for importing Mbox files into some common mail applications:

- [How to import Mbox files into Apple Mail](https://support.apple.com/guide/mail/import-or-export-mailboxes-mlhlp1030/mac)
- [How to import Mbox files into Mozilla Thunderbird](https://www.zooksoftware.com/blog/open-import-mbox-file-in-mozilla-thunderbird/)
