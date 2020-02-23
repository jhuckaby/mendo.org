# Overview

![Mendo.org Logo](https://pixlcore.com/software/mendo.org/images/logo-title-full.png)

**Mendo.org** is a community forum / discourse app with a web based UI.  It is designed to integrate with the [MCN Announce ListServ](http://www.mcn.org/email/listserv.html) for automatic message ingest, but it can also run independently of that system.  It is basically a big shared mailbox for everyone to read, and to send e-mails to.

Each incoming e-mail becomes a new "topic" if it has a unique subject line that has not been used recently.  Then, if more e-mails come in with the same (or very similar) subject, they are considered to be "replies" to that topic, and they are displayed in a simple threaded fashion.  Topics are categorized automatically by our staff (and coming soon, AI).

You can view content on the site in the following ways:

- **Recent Topics** &mdash; This displays the latest topic threads, with the newest on top.  You can also navigate back through history and look at older topics.
- **Hot Topics** &mdash; This displays the hottest topics threads (this really just means the topics with the most replies), sorted by hottest on top.
- **Calendar** &mdash; This shows you upcoming special events in the area, such as concerts, shows, and festivals.
- **Search** &mdash; Here you can compose your own custom search queries, and even save them for quick use in the sidebar.
- **Favorites** &mdash; These are saved messages that you liked, or just want to remember or read later.
- **Categores** &mdash; All topics are sorted into categories which are displayed on the sidebar.  Click to see the latest topics in each category.
- **Locations** &mdash; All topics are also sorted into locations (local city / town names), which are also available in the sidebar.

In all cases, you can click on the subject line of any topic to see details, including all the replies.  Icons are provided on the top-right corner of each topic that allows you to reply, mark it as a "favorite", or block the sender.

## Features at a Glance

- Post new topics and replies that can also be cross-posted to the ListServ.
- Threaded e-mail discussions (replies automatically organized under each topic).
- Automatic message classification and tagging via machine learning AI.
- Compact or expanded views of topics.
- Calendar of upcoming events in the area.
- Flag any topic or reply as a "favorite" to save it for later.
- Easily block specific senders with one click (okay, it's actually two clicks).
- Search by category, location, date, or custom text query.
- Save custom searches for quick access in the sidebar.
- Add "alerts" on searches, so you can be emailed for new matches.
- Download search results as [Mbox](https://en.wikipedia.org/wiki/Mbox) mail archives.
- Add attachments and images into your posts.
- Light and dark themes.
- Works great on PCs, tablets and phones.
- Completely free and open source.

## Table of Contents

<!-- toc -->
- [Installation](#installation)
- [Setup](#setup)
- [Configuration](#configuration)
	* [Basics](#basics)
		+ [base_app_url](#base_app_url)
		+ [email_from](#email_from)
		+ [smtp_hostname](#smtp_hostname)
		+ [smtp_port](#smtp_port)
		+ [mail_options](#mail_options)
		+ [log_dir](#log_dir)
		+ [log_filename](#log_filename)
		+ [log_columns](#log_columns)
		+ [log_archive_path](#log_archive_path)
		+ [pid_file](#pid_file)
		+ [debug_level](#debug_level)
		+ [maintenance](#maintenance)
	* [Storage Configuration](#storage-configuration)
		+ [Filesystem](#filesystem)
		+ [Couchbase](#couchbase)
		+ [Amazon S3](#amazon-s3)
	* [Web Server Configuration](#web-server-configuration)
	* [User Configuration](#user-configuration)
	* [Email Configuration](#email-configuration)
- [Command Line](#command-line)
	* [Starting and Stopping](#starting-and-stopping)
	* [Storage Maintenance](#storage-maintenance)
	* [Recover Admin Access](#recover-admin-access)
	* [Server Startup](#server-startup)
	* [Upgrading](#upgrading)
	* [Logs](#logs)
- [S3 Mail Ingest](#s3-mail-ingest)
- [Machine Learning](#machine-learning)
- [Database](#database)
- [API Reference](#api-reference)
	* [JSON REST API](#json-rest-api)
	* [API Keys](#api-keys)
	* [Standard Response Format](#standard-response-format)
	* [API Calls](#api-calls)
		+ [search](#search)
- [Development](#development)
	* [Installing Dev Tools](#installing-dev-tools)
	* [Manual Installation](#manual-installation)
	* [Starting in Debug Mode](#starting-in-debug-mode)
- [License](#license)

# Installation

Please note that Mendo.org currently only works on POSIX-compliant operating systems, which basically means Unix/Linux and OS X.

You'll need to have [Node.js](https://nodejs.org/en/download/) pre-installed on your server.  Then become root and type this:

```
curl -s https://raw.githubusercontent.com/jhuckaby/mendo.org/master/bin/install.js | node
```

This will install the latest stable release of Mendo.org and all of its dependencies under: `/opt/mendo/`

If you'd rather install it manually (or something went wrong with the auto-installer), here are the raw commands:

```
mkdir -p /opt/mendo
cd /opt/mendo
curl -L https://github.com/jhuckaby/mendo.org/archive/v1.0.0.tar.gz | tar zxvf - --strip-components 1
npm install
node bin/build.js dist
```

Replace `v1.0.0` with the desired Mendo.org version from the [release list](https://github.com/jhuckaby/mendo.org/releases), or `master` for the head revision (unstable).

# Setup

If this is your first time installing, please read the [Configuration](#configuration) section first.  You'll likely want to customize a few configuration parameters in the `/opt/mendo/conf/config.json` file before proceeding.  At the very least, you should set these properties:

| Key | Description |
|-----|-------------|
| `base_app_url` | A fully-qualified URL to Mendo.org on your server, including the `http_port` if non-standard.  This is used in e-mails to create self-referencing URLs. |
| `email_from` | The e-mail address to use as the "From" address when sending out notifications. |
| `smtp_hostname` | The hostname of your SMTP server, for sending mail.  This can be `127.0.0.1` or `localhost` if you have [sendmail](https://en.wikipedia.org/wiki/Sendmail) running locally. |
| `http_port` | The web server port number for the user interface.  Defaults to 5522. |

Now then, the only other decision you have to make is what to use as a storage back-end.  Mendo.org can use local disk (easiest setup), [Couchbase](http://www.couchbase.com/nosql-databases/couchbase-server) or [Amazon S3](https://aws.amazon.com/s3/).

With that out of the way, run the following script to initialize the storage system.  You only need to do this once:

```
/opt/mendo/bin/control.sh setup
```

Among other things, this creates an administrator user account you can use to login right away.  The username is `admin` and the password is `admin`.  It is recommended you change the password as soon as possible, for security purposes (or just create your own administrator account and delete `admin`).

At this point you should be able to start the service and access the web UI.  Enter this command:

```
/opt/mendo/bin/control.sh start
```

Then send your browser to the server on the correct port:

```
http://YOUR_SERVER_HOSTNAME:3012/
```

You only need to include the port number in the URL if you are using a non-standard HTTP port (see [Web Server Configuration](#web-server-configuration)).

# Configuration

The main Mendo.org configuration file is in JSON format, and can be found here:

```
/opt/mendo/conf/config.json
```

Please edit this file directly.  It will not be touched by any upgrades.  A pristine copy of the default configuration can always be found here: `/opt/mendo/sample_conf/config.json`.

## Basics

Here are descriptions of the top-level configuration parameters:

### base_app_url

This should be set to a fully-qualified URL, pointing to your Mendo.org server, including the HTTP port number if non-standard.  Do not include a trailing slash.  This is used in e-mails to create self-referencing URLs.  Example:

```
http://local.mendo.org:5522
```

If you are running Mendo.org behind a load balancer, this should be set to the load balanced virtual hostname.

### email_from

The e-mail address to use as the "From" address when sending out notifications.  Most SMTP servers require this to be a valid address to accept mail.

### smtp_hostname

The hostname of your SMTP server, for sending mail.  This can be set to `127.0.0.1` or `localhost` if you have [sendmail](https://en.wikipedia.org/wiki/Sendmail) running locally.

### smtp_port

The port number to use when communicating with the SMTP server.  The default is `25`.

### mail_options

Set specific mailer options, such as SMTP SSL and authentication, passed directly to [pixl-mail](https://www.github.com/jhuckaby/pixl-mail#options) (and then to [nodemailer](https://nodemailer.com/)).  Example:

```js
"mail_options": {
	"secure", true,
	"auth", { user: "fsmith", pass: "12345" },
	"connectionTimeout": 10000,
	"greetingTimeout": 10000,
	"socketTimeout": 10000
}
```

The `connectionTimeout`, `greetingTimeout` and `socketTimeout` properties are all expressed in milliseconds.

You can also use `mail_options` to use local [sendmail](https://nodemailer.com/transports/sendmail/), if you have that configured on your server.  To do this, set the following properties, and tune as needed:

```js
"mail_options": {
	"sendmail": true,
	"newline": "unix",
	"path": "/usr/sbin/sendmail"
}
```

You can omit `smtp_hostname` and `smtp_port` if you are using sendmail.

### log_dir

The directory where logs will be written, before they are archived.  This can be a partial path, relative to the Mendo.org base directory (`/opt/mendo`) or a full path to a custom location.  It defaults to `logs` (i.e. `/opt/mendo/logs`).

### log_filename

The filename to use when writing logs.  You have three options here: a single combined log file for all logs, multiple log files for each component, or multiple log files for each category (debug, transaction, error).  See the [Logs](#logs) section below for details.

### log_columns

This is an array of column IDs to log.  You are free to reorder or remove some of these, but do not change the names.  They are specific IDs that match up to log function calls in the code.  See the [Logs](#logs) section below for details.

### log_archive_path

Every night at midnight (local server time), the logs can be archived (gzipped) to a separate location.  This parameter specifies the path, and the directory naming / filenaming convention of the archive files.  It can utilize date placeholders including `[yyyy]`, `[mm]` and `[dd]`.

This can be a partial path, relative to the Mendo.org base directory (`/opt/mendo`) or a full path to a custom location.  It defaults to `logs/archives/[yyyy]/[mm]/[dd]/[filename]-[yyyy]-[mm]-[dd].log.gz`.

### pid_file

The PID file is simply a text file containing the Process ID of the main Mendo.org daemon.  It is used by the `control.sh` script to stop the daemon, and detect if it is running.  You should never have to deal with this file directly, and it defaults to living in the `logs` directory which is auto-created.  

This can be a partial path, relative to the Mendo.org base directory (`/opt/mendo`) or a full path to a custom location.  However, it should probably not be changed, as the `control.sh` script expects it to live in `logs/mendo.pid`.

### debug_level

The level of verbosity in the debug logs.  It ranges from `1` (very quiet) to `10` (extremely loud).  The default value is `9`.

### maintenance

Mendo.org needs to run storage maintenance once per day, which generally involves deleting expired records and trimming lists which have grown too large.  The application is still usable during this time, but UI performance may be slightly impacted.

By default the maintenance is set to run at 4:00 AM (local server time).  Feel free to change this to a more convenient time for your server environment.  The format of the parameter is `HH:MM`.

## Storage Configuration

The `Storage` object contains settings for the Mendo.org storage system.  This is built on the [pixl-server-storage](https://www.github.com/jhuckaby/pixl-server-storage) module, which can write everything to local disk (the default), [Couchbase](http://www.couchbase.com/nosql-databases/couchbase-server) or [Amazon S3](https://aws.amazon.com/s3/).

Note that since Mendo.org uses [full-text indexing](https://github.com/jhuckaby/pixl-server-storage/blob/master/docs/Indexer.md) for user content, specifically via [pixl-server-unbase](https://github.com/jhuckaby/pixl-server-unbase), it is highly recommended that you use the `Filesystem` engine.  Anything else, specially S3, would be excruciatingly slow.

To select a storage engine, place one of the following values into the `engine` property:

### Filesystem

The default storage method is to use local disk.  For this, set the `engine` property to `Filesystem`, and declare a sub-object with the same name, with a couple more properties:

```js
{
	"Storage": {
		"engine": "Filesystem",
		"Filesystem": {
			"base_dir": "data",
			"key_namespaces": 1
		}
	}
}
```

The `base_dir` is the base directory to store everything under.  It can be a fully-qualified filesystem path, or a relative path to the Mendo.org base directory (e.g. `/opt/mendo`).  In this case it will be `/opt/mendo/data`.

For more details on using the Filesystem as a backing store, please read the [Local Filesystem section in the pixl-server-storage docs](https://www.github.com/jhuckaby/pixl-server-storage#local-filesystem).

### Couchbase

To use Couchbase as a backing store for Mendo.org, please read the [Couchbase section in the pixl-server-storage docs](https://www.github.com/jhuckaby/pixl-server-storage#couchbase).  It has complete details for how to setup the storage object.  Example configuration:

```js
{
	"Storage": {
		"engine": "Couchbase",
		"Couchbase": {
			"connectString": "couchbase://127.0.0.1",
			"bucket": "default",
			"password": "",
			"serialize": false,
			"keyPrefix": "mendo"
		}
	}
}
```

If you are sharing a bucket with other applications, use the `keyPrefix` property to keep the Mendo.org data separate, in its own "directory".  For example, set `keyPrefix` to `"mendo"` to keep all the Mendo.org-related records in a top-level `mendo` directory in the bucket.

You'll also need to install the npm [couchbase](https://www.npmjs.com/package/couchbase) module:

```
cd /opt/mendo
npm install couchbase
```

After configuring Couchbase, you'll need to run the Mendo.org setup script manually, to recreate all the base storage records needed to bootstrap the system:

```
/opt/mendo/bin/control.sh setup
```

### Amazon S3

To use Amazon S3 as a backing store for Mendo.org, please read the [Amazon S3 section in the pixl-server-storage docs](https://www.github.com/jhuckaby/pixl-server-storage#amazon-s3).  It has complete details for how to setup the storage object.  Example configuration:

```js
{
	"Storage": {
		"engine": "S3",
		"AWS": {
			"accessKeyId": "YOUR_AMAZON_ACCESS_KEY", 
			"secretAccessKey": "YOUR_AMAZON_SECRET_KEY", 
			"region": "us-west-1",
			"correctClockSkew": true,
			"maxRetries": 5,
			"httpOptions": {
				"connectTimeout": 5000,
				"timeout": 5000
			}
		},
		"S3": {
			"keyPrefix": "mendo",
			"fileExtensions": true,
			"params": {
				"Bucket": "YOUR_S3_BUCKET_ID"
			}
		}
	}
}
```

If you are sharing a bucket with other applications, use the `keyPrefix` property to keep the Mendo.org data separate, in its own "directory".  For example, set `keyPrefix` to `"mendo"` to keep all the Mendo.org-related records in a top-level `mendo` directory in the bucket.  A trailing slash will be automatically added to the prefix if missing.

It is recommended that you always set the S3 `fileExtensions` property to `true` for new installs.  This makes the Mendo.org S3 records play nice with sync / copy tools such as [Rclone](https://rclone.org/).

To use S3 you'll also need to install the npm [aws-sdk](https://www.npmjs.com/package/aws-sdk) module:

```
cd /opt/mendo
npm install aws-sdk
```

After configuring S3, you'll need to run the Mendo.org setup script manually, to recreate all the base storage records needed to bootstrap the system:

```
/opt/mendo/bin/control.sh setup
```

## Web Server Configuration

Mendo.org has an embedded web server which handles serving up the user interface.  This is configured in the `WebServer` object, and there are only a handful of parameters you should ever need to configure:

```js
{
	"WebServer": {
		"http_port": 5522,
		
		"https": false,
		"https_port": 5523,
		"https_cert_file": "conf/ssl.crt",
		"https_key_file": "conf/ssl.key"
	}
}
```

Changing the `http_port` is probably the most common thing you will want to customize.  For example, if you don't have anything else running on port 80, you will probably want to change it to that, so you can access the UI without entering a port number.

This is also where you can enable HTTPS, if you want the UI to be SSL encrypted.  Set the `https` property to `true` to enable, and configure the `https_port` as you see fit (the standard HTTPS port is `443`).  You will have to supply your own SSL certificate files (sample self-signed certs are provided for testing, but they will generate browser warnings).

For more details on the web server component, please see the [pixl-server-web](https://www.github.com/jhuckaby/pixl-server-web#configuration) module documentation.

## User Configuration

Mendo.org has a simple user login and management system, which is built on the [pixl-server-user](https://www.github.com/jhuckaby/pixl-server-user) module.  It handles creating new users, assigning permissions, and login / session management.  It is configured in the `User` object, and there are only a couple of parameters you should ever need to configure:

```js
{
	"User": {
		"free_accounts": false,
		
		"default_privileges": {
			"admin": 0
		}
	}
}
```

The `free_accounts` property specifies whether guests visiting the UI can create their own accounts, or not.  This defaults to `false` (disabled), but you can set it to `true` to enable.

The `default_privileges` object specifies which privileges new accounts will receive by default.  Here is a list of all the possible privileges and what they mean:

| Privilege ID | Description |
|--------------|-------------|
| `admin` | User is a full administrator.  **This automatically grants ALL privileges, current and future.** |
| `post_topics` | User is allowed to post new topics via the API (Web UI). |
| `post_replies` | User is allowed to post replies via the API (Web UI). |
| `hashtags` | User is allowed to hashtag their posts into categories, e.g. `#politics`. |
| `mbox` | User is allowed to download [Mbox](https://en.wikipedia.org/wiki/Mbox) mail archives. |

By default new users have all the non-admin privileges.  Note that when an administrator creates new accounts via the UI, (s)he can customize the privileges at that point.  The configuration only sets the defaults.

For more details on the user manager component, please see the [pixl-server-user](https://www.github.com/jhuckaby/pixl-server-user#configuration) module documentation.

## Email Configuration

Mendo.org will send a number of different types of e-mails in response to certain events.  These are mostly confirmations of actions, forwarding messages for user search alerts, or just simple notifications.  Most of these can be disabled in the UI if desired.  The e-mail content is also configurable, including the `From` and `Subject` headers, and is based on plain text e-mail template files located on disk:

| Action | Email Template | Description |
|--------|----------------|-------------|
| **New User Account** | `conf/emails/welcome_new_user.txt` | Sent when a new user account is created. |
| **Changed Password** | `conf/emails/changed_password.txt` | Sent when a user changes their password. |
| **Recover Password** | `conf/emails/recover_password.txt` | Sent when a user requests password recovery. |
| **Logout All Sessions** | `conf/emails/logout_all_sessions.txt` | Sent when a user requests all sessions be logged out (security feature). |
| **Verify Email** | `conf/emails/verify_email.txt` | Sent when a user requests e-mail re-verification. |

Feel free to edit these files to your liking.  Note that any text in `[/square_brackets]` is a placeholder which gets swapped out with live data relevant to the event which fired off the e-mail.

The stock e-mail templates shipped with Mendo.org are plain text, but you can provide your own rich HTML e-mail templates if you want.  Simply start the e-mail body content (what comes after the Subject line) with an HTML open tag, e.g. `<div>`, and the e-mails will be sent as HTML instead of text.

You can include any property from the main `conf/config.json` file by using the syntax `[/config/KEY]`.  Also, to include environment variables, use the syntax `[/env/ENV_KEY]`, for example `[/env/NODE_ENV]`.

# Command Line

Here are all the Mendo.org services available to you on the command line.  Most of these are accessed via the following shell script:

```
/opt/mendo/bin/control.sh [COMMAND]
```

Here are all the accepted commands:

| Command | Description |
|---------|-------------|
| `start` | Starts Mendo.org in daemon mode. See [Starting and Stopping](#starting-and-stopping). |
| `stop` | Stops the Mendo.org daemon and waits for exit. See [Starting and Stopping](#starting-and-stopping). |
| `restart` | Calls `stop`, then `start`, in sequence. See [Starting and Stopping](#starting-and-stopping).  |
| `status` | Checks whether Mendo.org is currently running. See [Starting and Stopping](#starting-and-stopping).  |
| `setup` | Runs initial storage setup (for first time install). See [Setup](#setup). |
| `maint` | Runs daily storage maintenance routine. See [Storage Maintenance](#storage-maintenance). |
| `admin` | Creates new emergency admin account (specify user / pass). See [Recover Admin Access](#recover-admin-access). |
| `upgrade` | Upgrades Mendo.org to the latest stable (or specify version). See [Upgrading](#upgrading). |
| `version` | Outputs the current Mendo.org package version and exits. |
| `help` | Displays a list of available commands and exits. |

## Starting and Stopping

To start the service, use the `start` command:

```
/opt/mendo/bin/control.sh start
```

And to stop it, the `stop` command:

```
/opt/mendo/bin/control.sh stop
```

You can also issue a quick stop + start with the `restart` command:

```
/opt/mendo/bin/control.sh restart
```

The `status` command will tell you if the service is running or not:

```
/opt/mendo/bin/control.sh status
```

## Storage Maintenance

Storage maintenance automatically runs every morning at 4 AM local server time (this is [configurable](#maintenance) if you want to change it).  The operation is mainly for deleting expired records, and pruning lists that have grown too large.  However, if the Mendo.org service was stopped and you missed a day or two, you can force it to run at any time.  Just execute this command on your master server:

```
/opt/mendo/bin/control.sh maint
```

This will run maintenance for the current day.  However, if the service was down for more than one day, please run the command for each missed day, providing the date in `YYYY-MM-DD` format:

```
/opt/mendo/bin/control.sh maint 2015-10-29
/opt/mendo/bin/control.sh maint 2015-10-30
```

## Recover Admin Access

Lost access to your admin account?  You can create a new temporary administrator account on the command-line.  Just execute this command on your master server:

```
/opt/mendo/bin/control.sh admin USERNAME PASSWORD
```

Replace `USERNAME` with the desired username, and `PASSWORD` with the desired password for the new account.  Note that the new user will not show up in the master list of users in the UI.  But you will be able to login using the provided credentials.  This is more of an emergency operation, just to allow you to get back into the system.  *This is not a good way to create permanent users*.  Once you are logged back in, you should consider creating another account from the UI, then deleting the emergency admin account.

## Server Startup

Here are the instructions for making Mendo.org automatically start on server boot.  Type these commands as root:

```
cd /opt/mendo
npm run boot
```

## Upgrading

To upgrade Mendo.org, you can use the built-in `upgrade` command:

```
/opt/mendo/bin/control.sh upgrade
```

This will upgrade the app and all dependencies to the latest stable release, if a new one is available.  It will not affect your data storage, users, or configuration settings.  All those will be preserved and imported to the new version.

Alternately, you can specify the exact version you want to upgrade (or downgrade) to:

```
/opt/mendo/bin/control.sh upgrade 1.0.4
```

If you upgrade to the `HEAD` version, this will grab the very latest from GitHub.  Note that this is primarily for developers or beta-testers, and is likely going to contain bugs.  Use at your own risk:

```
/opt/mendo/bin/control.sh upgrade HEAD
```

## Logs

Mendo.org writes its logs in a plain text, square-bracket delimited column format, which looks like this:

```
[1582307632.086][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][1][Mendo v0.9.1 Starting Up][]
[1582307632.088][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][9][Writing PID File: logs/mendo.pid: 19657][]
[1582307632.089][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][9][Confirmed PID File contents: logs/mendo.pid: 19657][]
[1582307632.09][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][2][Server IP: 192.168.3.40, Daemon PID: 19657][]
[1582307632.09][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][3][Starting component: Storage][]
[1582307632.094][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][3][Starting component: Unbase][]
[1582307632.095][2020-02-21 09:53:52][joe16.local][19657][Unbase][debug][2][Setting up Unbase v1.0.3][]
[1582307632.097][2020-02-21 09:53:52][joe16.local][19657][Unbase][debug][3][Initializing index: messages][]
[1582307632.097][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][3][Starting component: WebServer][]
[1582307632.098][2020-02-21 09:53:52][joe16.local][19657][WebServer][debug][2][pixl-server-web v1.1.28 starting up][]
[1582307632.101][2020-02-21 09:53:52][joe16.local][19657][WebServer][debug][2][Starting HTTP server on port: 5522][]
[1582307632.104][2020-02-21 09:53:52][joe16.local][19657][WebServer][debug][3][Now listening for HTTP connections][{"address":"::","family":"IPv6","port":5522}]
[1582307632.104][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][3][Starting component: API][]
[1582307632.104][2020-02-21 09:53:52][joe16.local][19657][API][debug][3][API service listening for base URI: /api][]
[1582307632.105][2020-02-21 09:53:52][joe16.local][19657][WebServer][debug][3][Adding custom URI handler: /\/api\/(\w+)/: API][]
[1582307632.105][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][3][Starting component: User][]
[1582307632.105][2020-02-21 09:53:52][joe16.local][19657][User][debug][3][User Manager starting up][]
[1582307632.105][2020-02-21 09:53:52][joe16.local][19657][API][debug][3][Adding API namespace: user][]
[1582307632.106][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][3][Starting component: ML][]
[1582307632.106][2020-02-21 09:53:52][joe16.local][19657][ML][debug][3][ML subsystem starting up][]
[1582307632.107][2020-02-21 09:53:52][joe16.local][19657][ML][debug][6][Loading model: ml/model.bin][]
[1582307632.949][2020-02-21 09:53:52][joe16.local][19657][ML][debug][6][Model load complete][{"pid":19658}]
[1582307632.949][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][3][Starting component: Mendo][]
[1582307632.95][2020-02-21 09:53:52][joe16.local][19657][WebServer][debug][3][Adding custom URI handler: /^\/$/: Home][]
[1582307632.95][2020-02-21 09:53:52][joe16.local][19657][API][debug][3][Adding API namespace: app][]
[1582307632.95][2020-02-21 09:53:52][joe16.local][19657][WebServer][debug][3][Adding custom URI handler: /^\/files/: File][]
[1582307632.95][2020-02-21 09:53:52][joe16.local][19657][WebServer][debug][3][Adding custom URI handler: /server-status: Server Status][]
[1582307632.951][2020-02-21 09:53:52][joe16.local][19657][WebServer][debug][3][Adding custom URI handler: /^\/privacy/: Redirect][]
[1582307632.951][2020-02-21 09:53:52][joe16.local][19657][WebServer][debug][3][Adding custom URI handler: /^\/terms/: Redirect][]
[1582307632.951][2020-02-21 09:53:52][joe16.local][19657][WebServer][debug][3][Adding custom URI handler: /^\/optout/: Redirect][]
[1582307632.951][2020-02-21 09:53:52][joe16.local][19657][WebServer][debug][3][Adding custom URI handler: /^\/login/: Redirect][]
[1582307632.951][2020-02-21 09:53:52][joe16.local][19657][WebServer][debug][3][Adding custom URI handler: /^\/signup/: Redirect][]
[1582307632.96][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][3][Starting component: S3MailIngest][]
[1582307632.961][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][2][Startup complete, entering main loop][]
[1582307632.971][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][5][Setting up user search triggers][]
[1582307632.976][2020-02-21 09:53:52][joe16.local][19657][Mendo][debug][5][1 user search triggers added][]
```

The log columns are defined as follows, from left to right:

| Log Column | Description |
|------------|-------------|
| `hires_epoch` | A date/time stamp in high-resolution [Epoch time](https://en.wikipedia.org/wiki/Unix_time). |
| `date` | A human-readable date/time stamp in the format: `YYYY/MM/DD HH:MI:SS` (local server time) |
| `hostname` | The hostname of the server that wrote the log entry (useful for multi-server setups if you merge your logs together). |
| `pid` | The PID (Process ID) of the process that logged the event. |
| `component` | The component name which generated the log entry.  See below for a list of all the components. |
| `category` | The category of the log entry, which will be one of `debug`, `transaction` or `error`. |
| `code` | Debug level (1 to 10), transaction or error code. |
| `msg` | Debug, transaction or error message text. |
| `data` | Additional JSON data, may or may not present. |

The columns are configurable via the [log_columns](#log_columns) property in the `conf/config.json` file:

```js
{
	"log_columns": ["hires_epoch", "date", "hostname", "pid", "component", "category", "code", "msg", "data"]
}
```

Feel free to reorder or remove columns, but don't rename any.  The IDs are special, and match up to keywords in the source code.

By default, logging consists of several different files, each for a specific component of the system.  After starting up Mendo.org, you will find these log files in the [log_dir](#log_dir) directory:

| Log Filename | Description |
|--------------|-------------|
| `Mendo.log` | The main component will contain most of the app logic. |
| `Error.log` | The error log will contain all main application errors. |
| `Transaction.log` | The transaction log will contain all main application transactions. |
| `API.log` | The API component log will contain information about incoming HTTP API calls. |
| `Storage.log` | The storage component log will contain information about data reads and writes. |
| `Filesystem.log` | Only applicable if you use the local filesystem storage back-end. |
| `Couchbase.log` | Only applicable if you use the [Couchbase](#couchbase) storage back-end. |
| `S3.log` | Only applicable if you use the [Amazon S3](#amazon-s3) storage back-end. |
| `User.log` | The user component log will contain user related information such as logins and logouts. |
| `WebServer.log` | The web server component log will contain information about HTTP requests and connections. |
| `ML.log` | This log will contain details about the machine learning system, for categorizing posts.  |
| `S3MailIngest.log` |  This log will contain details about the AWS S3 / SES mail ingest system. |
| `crash.log` | If Mendo.org crashed for any reason, you should find a date/time and stack trace in this log. |
| `recovery.log` | If the database suffered an unclean shutdown, this log will contain recovery information (i.e. transaction rollbacks). |
| `install.log` | Contains detailed installation notes from npm, and the build script. |

The [log_filename](#log_filename) configuration property controls this, and by default it is set to the following:

```js
{
	"log_filename": "[component].log",
}
```

This causes the value of the `component` column to dictate the actual log filename.  If you would prefer that everything be logged to a single combo file instead, just change this to a normal string without brackets, such as:

```js
{
	"log_filename": "event.log",
}
```

# S3 Mail Ingest

Mendo.org ingests incoming e-mails from the [AWS Simple Email Service](https://aws.amazon.com/ses/) (SES), specifically the [S3 Action](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/receiving-email-action-s3.html), where mail is dropped into a S3 bucket.  The Mendo.org daemon polls this S3 bucket every minute, and parses the raw MIME files found there (and deletes them).

The configuration for the S3 mail ingest system is under a `S3MailIngest` key.  Example:

```js
"S3MailIngest": {
	"schedule": "minute",
	"base_dir": "mail",
	"key_prefix": "incoming/",
	"api_key": "internal",
	
	"AWS": {
		"accessKeyId": "YOUR_ACCESS_KEY_HERE",
		"secretAccessKey": "YOUR_SECRET_KEY_HERE",
		"region": "us-west-2",
		"correctClockSkew": true,
		"maxRetries": 5,
		"httpOptions": {
			"connectTimeout": 5000,
			"timeout": 5000
		}
	},
	"S3": {
		"params": {
			"Bucket": "YOUR_S3_BUCKET_HERE"
		}
	}
},
```

Here are descriptions of the configuration properties:

| Property Name | Description |
|---------------|-------------|
| `schedule` | The controls the frequency of the polling operation.  Should be set to `minute` to poll every minute.  See [pixl-server maintenance events](https://github.com/jhuckaby/pixl-server#maintenance-events) for details. |
| `base_dir` | This is the base directory where parsed JSON mail messages are stored, for backup purposes.  This is relative to the `/opt/mendo` base directory, and is created if it does not exist. |
| `key_prefix` | This is the S3 key prefix for where to look for incoming mail from SES.  This should match your SES S3 action settings in the AWS console. |
| `api_key` | This is the Mendo.org API key to use for posting messages into the database.  This can be `internal` to use the localhost API backdoor. |
| `AWS` | These settings are for the [aws-sdk](https://www.npmjs.com/package/aws-sdk) setup.  Make sure you insert your own `accessKeyId` and `secretAccessKey`. |
| `S3` | These settings are specifically for the S3 API constructor, and should include your bucket name. |

# Machine Learning

Mendo.org utilizes [machine learning](https://en.wikipedia.org/wiki/Machine_learning) to automatically categorize incoming messages.  Currently we are using the [fastText](https://fasttext.cc/) library, however this is subject to change, as we are still evaluating several other options.

The configuration for the ML system is under a `ML` key.  Example:

```js
"ML": {
	"enabled": true,
	"dir": "ml",
	"mode": "suggest",
	"train_schedule": "03:00",
	"train_options": {
		"thread": 4
	}
}
```

Here are descriptions of the configuration properties:

| Property Name | Description |
|---------------|-------------|
| `enabled` | This boolean indicates whether the ML system is active (`true`) or disabled (`false`). |
| `dir` | This is the base directory where the ML training and model files are stored.  This is relative to the `/opt/mendo` base directory, and is created if it does not exist. |
| `mode` | This controls the mode, which can either be `suggest` or `active`. |
| `train_schedule` | The sets the schedule for the training operation.  This should run daily, and happen during a period of inactivity on the site, due to potential slowdown.  See [pixl-server maintenance events](https://github.com/jhuckaby/pixl-server#maintenance-events) for details. |
| `train_options` | This object is passed directly to the fastText engine when training.  See [their training docs](https://github.com/loretoparisi/fasttext.js#train) for details. |

When the `mode` property is set to `suggest`, message categorization is not applied automatically.  Instead, administrators will see a suggested set of categories that would be applied.  This information will be shown on the bottom-right corner of all unsorted messages in any standard view.

When the `mode` property is set to `active`, then automatic categorization will take place on any incoming topic, either from a API (Web UI) post, or an incoming mail message.  Only activate this mode when you are sure that the model is fully trained, and most suggestions are what you want.

Training works by essentially dumping the entire database every night, and generating a training file containing all the manually-categorized topics, their category labels and serialized / normalized body text.  The fastText engine then reads the training file and generates a prediction model, for applying to new incoming messages that have yet to be categorized.  The training process repeats nightly.

# Database

Mendo.org uses [pixl-server-unbase](https://github.com/jhuckaby/pixl-server-unbase), which is a database-like system, built on top of [pixl-server-storage](https://github.com/jhuckaby/pixl-server-storage).  It is basically a thin wrapper around the [Indexer](https://github.com/jhuckaby/pixl-server-storage/blob/master/docs/Indexer.md), with some additional record storage, database management and live search capabilities.

The main idea behind Unbase is to provide a database (or something sort of like one) on top of simple JSON files on disk (or S3 if you are insane).  Both the record data and the indexes are built out of simple JSON documents.  It uses as little memory as possible, at the cost of speed.

The database "schema" (if you can call it that) is as follows:

```js
"Unbase": {
	"indexes": {
		"messages": {
			"default_search_field": "body",
			"fields": [
				{
					"id": "type",
					"source": "/type",
					"master_list": true
				},
				{
					"id": "tags",
					"source": "/tags",
					"master_list": true,
					"default_value": "unsorted"
				},
				{
					"id": "locations",
					"source": "/locations",
					"master_list": true,
					"default_value": "_none_"
				},
				{
					"id": "favorites",
					"source": "/favorites"
				},
				{
					"id": "parent",
					"source": "/parent"
				},
				{
					"id": "date",
					"source": "/date",
					"type": "date"
				},
				{
					"id": "when",
					"source": "/when",
					"type": "date"
				},
				{
					"id": "from",
					"source": "[/from] [/username]",
					"min_word_length": 3,
					"max_word_length": 32,
					"max_words": 10,
					"use_remove_words": false,
					"use_stemmer": false
				},
				{
					"id": "subject",
					"source": "/subject",
					"min_word_length": 3,
					"max_word_length": 32,
					"max_words": 50,
					"use_remove_words": true,
					"use_stemmer": true
				},
				{
					"id": "body",
					"source": "[/subject] [/from] [/body]",
					"min_word_length": 3,
					"max_word_length": 32,
					"max_words": 500,
					"use_remove_words": true,
					"use_stemmer": true
				},
				{
					"id": "replies",
					"source": "/replies",
					"type": "number"
				}
			],
			"sorters": [
				{
					"id": "replies",
					"source": "/replies",
					"type": "number"
				}
			],
			"remove_words": ["the", "of", "and", "a", "to", "in", "is", "you", "that", "it", "he", "was", "for", "on", "are", "as", "with", "his", "they", "I", "at", "be", "this", "have", "from", "or", "one", "had", "by", "word", "but", "not", "what", "all", "were", "we", "when", "your", "can", "said", "there", "use", "an", "each", "which", "she", "do", "how", "their", "if", "will", "up", "other", "about", "out", "many", "then", "them", "these", "so", "some", "her", "would", "make", "like", "him", "into", "has", "look", "two", "more", "go", "see", "no", "way", "could", "my", "than", "been", "who", "its", "now", "did", "get", "come", "made"]
		}
	}
}
```

See the [Indexer Configuration](https://github.com/jhuckaby/pixl-server-storage/blob/master/docs/Indexer.md#configuration) documentation for details on this format.

# API Reference

## JSON REST API

All API calls expect JSON as input (unless they are simple HTTP GETs), and will return JSON as output.  The main API endpoint is:

```
/api/app/NAME/v1
```

Replace `NAME` with the specific API function you are calling (see below for list).  All requests should be HTTP GET or HTTP POST as the API dictates, and should be directed at the Mendo.org server on the correct TCP port (the default is `5522` but is often reconfigured to be `80`).  Example URL:

```
http://myserver.com:5522/api/app/search/v1
```

For web browser access, [JSONP](https://en.wikipedia.org/wiki/JSONP) response style is supported for all API calls, by including a `callback` query parameter.  However, all responses include a `Access-Control-Allow-Origin: *` header, so cross-domain [XHR](https://en.wikipedia.org/wiki/XMLHttpRequest) requests will work as well.

## API Keys

API Keys allow you to register external applications or services to use the REST API.  These can be thought of as special user accounts specifically for applications.  Each API key can be granted a specific set of privileges.

To create an API Key, you must first be an administrator level user.  Login to the Mendo.org UI, proceed to the **API Keys Tab**, and click the "Add API Key..." button.  Fill out the form and click the "Create Key" button at the bottom of the page.

API Keys are randomly generated hexadecimal strings, and are 32 characters in length.  Example:

```
0095f5b664b93304d5f8b1a61df605fb
```

You must include a valid API Key with every API request.  There are three ways to do this: include a `X-API-Key` HTTP request header, an `api_key` query string parameter, or an `api_key` JSON property.

Here is a raw HTTP request showing all three methods of passing the API Key (only one of these is required):

```
GET /api/app/search/v1?api_key=0095f5b664b93304d5f8b1a61df605fb HTTP/1.1
Host: mendo.org
X-API-Key: 0095f5b664b93304d5f8b1a61df605fb
Content-Type: application/json

{"offset": 0, "limit": 50, "api_key": "0095f5b664b93304d5f8b1a61df605fb"}
```

## Standard Response Format

Regardless of the specific API call you requested, all responses will be in JSON format, and include at the very least a `code` property.  This will be set to `0` upon success, or any other value if an error occurred.  In the event of an error, a `description` property will also be included, containing the error message itself.  Individual API calls may include additional properties, but these two are standard fare in all cases.  Example successful response:

```js
{ "code": 0 }
```

Example error response:

```js
{"code": "session", "description": "No Session ID or API Key could be found"}
```

## API Calls

Here is the list of supported API calls:

### search

```
/api/app/search/v1
```

This API call searches the database, given any query, and returns matching results.  It supports pagination to fetch chunks, with the default being the first match.  Both HTTP GET (query string) or HTTP POST (JSON data) are acceptable.  Parameters:

| Parameter Name | Type | Description |
|----------------|------|-------------|
| `query` | String | **(Required)** The search query.  See the [search docs](https://github.com/jhuckaby/mendo.org/blob/master/docs/search.md) for details on the syntax.
| `offset` | Integer | (Optional) The offset into the data to start returning records, defaults to 0. |
| `limit` | Integer | (Optional) The number of records to return, defaults to 1.  The maximum allowed limit is 100. |
| `sort_by` | String | (Optional) Which column to sort by.  Defaults to `_id` (primary index) which is recommended for performance reasons.  This produces a natural organic sort by post date, as the IDs are time-based and alphanumerically sortable. |
| `sort_dir` | Integer | (Optional) Sort direction, which can be `1` for ascending or `-1` for descending.  Defaults to descending. |
| `compact` | Boolean | (Optional) If set to `true` the message `body` property will be omitted from the search results. |

Example request:

```js
{
	"query": "type:topic date:today",
	"offset": 0,
	"limit": 1
}
```

Example response:

```js
{
	"code": 0,
	"total": 28,
	"records": [
		{
			"id": "mk6q38pvv01",
			"username": "admin",
			"type": "topic",
			"from": "Administrator <admin@localhost>",
			"subject": "Super Bowl?",
			"body": "Can I watch the superbowl at someone's house please?",
			"date": 1581921542,
			"parent": "",
			"replies": 5,
			"locations": "",
			"tags": "wanted"
		}
	]
}
```

In addition to the [Standard Response Format](#standard-response-format), this API will include the following:

The `total` property shows the total matched records (ignoring pagination).

The `records` array will contain an element for every matched message in the search results (within the limits of pagination).  It will contain up to `limit` elements, and at the specified `offset` into the full result list.  Each record entry will contain the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `id` | String | A unique alphanumeric ID for the message. |
| `username` | String | If the post was from a Mendo.org registered user, this will contain their username. |
| `type` | String | Message type, will be either `topic` or `reply`. |
| `from` | String | The cleaned e-mail `From` header. |
| `subject` | String | The cleaned e-mail `Subject` header. |
| `body` | String | The cleaned e-mail body text. |
| `date` | Integer | The date of the post or incoming e-mail, in [Epoch seconds](https://en.wikipedia.org/wiki/Unix_time). |
| `parent` | String | If the message is a reply, this is the ID of the parent topic. |
| `replies` | Integer | If the message is a topic, this is the number of replies it has. |
| `locations` | String | For topics only, this is a CSV string of all locations found in the message body (e.g. `elk`, `mendocino`, `fortbragg`). |
| `tags` | String | For topics only, this is a CSV string of all categories for the message (e.g. `arts` ,`classes`, `politics`). |

# Development

Mendo.org runs as a component in the [pixl-server](https://www.github.com/jhuckaby/pixl-server) framework.  It is highly recommended to read and understand that module and its component system before attempting to develop Mendo.org.  The following server components are also used:

| Module Name | Description | License |
|-------------|-------------|---------|
| [pixl-server-api](https://www.github.com/jhuckaby/pixl-server-api) | A JSON API component for the pixl-server framework. | MIT |
| [pixl-server-storage](https://www.github.com/jhuckaby/pixl-server-storage) | A key/value/list storage component for the pixl-server framework. | MIT |
| [pixl-server-unbase](https://www.github.com/jhuckaby/pixl-server-unbase) | A database component for the pixl-server framework. | MIT |
| [pixl-server-user](https://www.github.com/jhuckaby/pixl-server-user) | A basic user login system for the pixl-server framework. | MIT |
| [pixl-server-web](https://www.github.com/jhuckaby/pixl-server-web) | A web server component for the pixl-server framework. | MIT |

In addition, Mendo.org uses the following server-side PixlCore utility modules:

| Module Name | Description | License |
|-------------|-------------|---------|
| [pixl-args](https://www.github.com/jhuckaby/pixl-args) | A simple module for parsing command line arguments. | MIT |
| [pixl-class](https://www.github.com/jhuckaby/pixl-class) | A simple module for creating classes, with inheritance and mixins. | MIT |
| [pixl-config](https://www.github.com/jhuckaby/pixl-config) | A simple JSON configuration loader. | MIT |
| [pixl-logger](https://www.github.com/jhuckaby/pixl-logger) | A simple logging class which generates bracket delimited log columns. | MIT |
| [pixl-mail](https://www.github.com/jhuckaby/pixl-mail) | A very simple class for sending e-mail via SMTP. | MIT |
| [pixl-perf](https://www.github.com/jhuckaby/pixl-perf) | A simple, high precision performance tracking system. | MIT |
| [pixl-request](https://www.github.com/jhuckaby/pixl-request) | A very simple module for making HTTP requests. | MIT |
| [pixl-tools](https://www.github.com/jhuckaby/pixl-tools) | A set of miscellaneous utility functions for Node.js. | MIT |

## Installing Dev Tools

For Debian (Ubuntu) OSes:

```
apt-get install build-essential
```

For RedHat (Fedora / CentOS):

```
yum install gcc-c++ make
```

For Mac OS X, download [Apple's Xcode](https://developer.apple.com/xcode/download/), and then install the [command-line tools](https://developer.apple.com/downloads/).

## Manual Installation

Here is how you can download the very latest Mendo.org dev build and install it manually (may contain bugs!):

```
git clone https://github.com/jhuckaby/mendo.org.git
cd mendo
npm install
node bin/build.js dev
```

This will keep all JavaScript and CSS unobfuscated (original source served as separate files).

I highly recommend placing the following `.gitignore` file at the base of the project, if you plan on committing changes and sending pull requests:

```
.gitignore
/node_modules
/work
/logs
/data
/conf
/ml
htdocs/index.html
htdocs/js/external/*
htdocs/js/common
htdocs/fonts/*
htdocs/css/font*
htdocs/css/mat*
htdocs/css/base.css
htdocs/css/normalize.css
```

## Starting in Debug Mode

To start Mendo.org in debug mode, issue the following command:

```
./bin/control.sh debug
```

This will launch the service without forking a daemon process, and echo the entire debug log contents to the console.  This is great for debugging server-side issues.  Beware of file permissions if you run as a non-root user.  Hit Ctrl-C to shut down the service when in this mode.

# License

The MIT License (MIT)

Copyright (c) 2019 - 2020 Joseph Huckaby

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
