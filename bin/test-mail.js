#!/usr/bin/env node

// Test outgoing mail.
// Copyright (c) 2020 Joseph Huckaby
// Released under the MIT License

var Path = require('path');
var cp = require('child_process');
var os = require('os');
var fs = require('fs');
var Mail = require('pixl-mail');

var cli = require('pixl-cli');
cli.global();

var Tools = cli.Tools;
var args = cli.args;

// chdir to the proper server root dir
process.chdir( Path.dirname( __dirname ) );

// load app's config file
var config = require('../conf/config.json');

var hostname = os.hostname();
var nice_date_time = (new Date()).toString();

var mail = new Mail(
	config.smtp_hostname || "127.0.0.1",
	config.smtp_port || 25
);
mail.setOptions( config.mail_options || {} );

var to = config.special_fwd_address;
var from = config.email_from;
var subject = "Mendo.org Test Mail " + Tools.generateShortID();
var body = '';

body += "Hostname: " + hostname + "\n";
body += "Date/Time: " + nice_date_time + "\n\n";

body += "Now is the time for all good men to come to the aid of their country.\n\n";

var message = 
	"To: " + to + "\n" + 
	"From: " + from + "\n" + 
	"Subject: " + subject + "\n" +
	"\n" +  
	body;

print(message + "\n\n");

mail.send( message, function(err) {
	if (err) console.error( "Mail Error: " + err );
	else print("Email sent successfully.\n");
} );
