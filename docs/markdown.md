## Formatting Guide

Mendo.org e-mails are predominantly plain text, as that is the format required by the MCN ListServ.  However, we can get around this limitation by using a text enhancement called [Markdown](https://en.wikipedia.org/wiki/Markdown).  This system allows you to include simple styling "hints" in your posts and replies, such as `*asterisks*` for italics, `**double asterisks**` for bold, and a few more tricks like that.

This is entirely optional, and the styling will only show up when your posts are read on Mendo.org.  In e-mail form, they will show as plain symbols.  However, Markdown is designed so that it is pleasing to read, even if not styled.

### Toolbar Icons

The toolbar icons you see when composing posts or replies are simply convenience macros for inserting various Markdown formatting symbols.  Here are descriptions of each:

| Icon | Name | Description |
|------|------|-------------|
| <i class="mdi mdi-format-header-1"></i> | Header&nbsp;1 | This inserts a level 1 heading, which makes the text very large indeed.  This can be typed by beginning a line with a single `#` (hash mark), followed by a space. |
| <i class="mdi mdi-format-header-2"></i> | Header&nbsp;2 | This inserts a level 2 heading, which makes the text quite large.  This can be typed by beginning a line with a two hash marks (`##`), followed by a space. |
| <i class="mdi mdi-format-header-3"></i> | Header&nbsp;3 | This inserts a level 3 heading, which makes the text fairly large.  This can be typed by beginning a line with a three hash marks (`###`), followed by a space. |
| <i class="mdi mdi-format-bold"></i> | Bold | This toggles the selected text between **bold**, or plain style.  Bold can be typed by surrounding your text with `**double asterisks**`. |
| <i class="mdi mdi-format-italic"></i> | Italic | This toggles the selected text between *italic*, or plain style.  Italic can be typed by surrounding your text with `*single asterisks*`. |
| <i class="mdi mdi-format-strikethrough"></i> | Strikethrough | This toggles the selected text between ~~strikethrough~~, or plain text.  Strikethrough can be typed by surrounding your text with `~~double tildes~~`. |
| <i class="mdi mdi-format-list-bulleted-square"></i> | Bullet&nbsp;List | This inserts a bulleted list into your post.  Bulleted lists can be typed by start a line with a hyphen (`-`), followed by a space. |
| <i class="mdi mdi-format-list-numbered"></i> | Number&nbsp;List | This inserts a numbered list into your post.  Numbered lists can be typed by start a line with a number (`1.`), followed by a space. |
| <i class="mdi mdi-format-quote-open"></i> | Blockquote | This inserts a blockquote into your post.  A blockquote is useful for quoting a previous reply or post, as the text will be offset and displayed in italics.  You can type a blockquote by starting a line with an angle bracket (`>`), followed by a space. |
| <i class="mdi mdi-file-find-outline"></i> | Show&nbsp;Preview | Click this button to see your post with all formatting applied.  This is how it will apppear to readers on Mendo.org. |

### Example Post

For a more complete example, consider this text post:

```
It's very easy to make some words **bold** and other words *italic* with Markdown.

Sometimes you want numbered lists:

1. One
2. Two
3. Three

Sometimes you want bullet points:

- Start a line with a star
- Profit!
- And if you have sub topics, put two spaces or a tab before the dash:
	- Like this
	- And this

Got something really important to say?  Make it a chapter marker:

# This will be VERY large!

Want to quote something, like a reply?  Prefix it with an angle bracket:

> This is quoted text!  It will be indented and styled differently.

> > This is quoted two levels deep!

Links become clickable automatically: http://google.com/

The end!
```

This post would show up on Mendo.org looking like the following:

<div class="box"><div class="box_content">

It's very easy to make some words **bold** and other words *italic* with Markdown.

Sometimes you want numbered lists:

1. One
2. Two
3. Three

Sometimes you want bullet points:

- Start a line with a star
- Profit!
- And if you have sub topics, put two spaces or a tab before the dash:
	- Like this
	- And this

Got something really important to say?  Make it a chapter marker:

<h1 style="color:var(--body-text-color);">This will be VERY large!</h1>

Want to quote something, like a reply?  Prefix it with an angle bracket:

> This is quoted text!  It will be indented and styled differently.

> > This is quoted two levels deep!

Links become clickable automatically: http://google.com/

The end!

</div></div>

For more details about Markdown formatting, see this [helpful guide](https://guides.github.com/features/mastering-markdown/) provided by GitHub.

Happy posting!
