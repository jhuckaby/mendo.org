#!/usr/bin/env node

// Simple process monitor for Mendo.org
// Will restart on crash, and send e-mail to admin with crash log.
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
var pid_file = config.pid_file;
var crash_log = Path.join( config.log_dir, config.crash_filename || 'crash.log' );

// no PID file?  we done.
if (!fs.existsSync(pid_file)) process.exit(0);

var pid = parseInt( fs.readFileSync(pid_file) );
if (!pid) process.exit(0);

try {
	process.kill(pid, 0);
	verbose("PID is alive and responding: " + pid + "\n");
}
catch(err) {
	verbose("OMG PID IS DEAD: " + pid + "\n");
	drasticMeasures();
}

function drasticMeasures() {
	// restart process and send e-mail
	var hostname = os.hostname();
	var nice_date_time = (new Date()).toString();
	
	// save logs at time of crash (will make it easier to track down)
	var log_archive_file = Tools.formatDate( Tools.timeNow(true), 'crash-log-archive-[yyyy]-[mm]-[dd]-[hh]-[mi]-[ss].tar.gz' );
	try { cp.execSync( "/usr/bin/tar zcf " + log_archive_file + " logs/*.log" ); }
	catch (e) {;}
	
	var restart_output = '';
	try { restart_output = cp.execSync("bin/control.sh start"); }
	catch (e) {;}
	
	var crash_log_contents = '';
	if (fs.existsSync(crash_log)) crash_log_contents = fs.readFileSync(crash_log);
	
	var mail = new Mail(
		config.smtp_hostname || "127.0.0.1",
		config.smtp_port || 25
	);
	mail.setOptions( config.mail_options || {} );
	
	var to = config.special_fwd_address;
	var from = config.email_from;
	var subject = "Mendo.org CRASHED on " + hostname;
	var body = '';
	
	body += "Hostname: " + hostname + "\n";
	body += "Date/Time: " + nice_date_time + "\n\n";
	
	body += "Crash Log:\n" + crash_log_contents + "\n\n";
	body += "Restart Output:\n" + restart_output + "\n\n";
	body += "Log Archive:\n" + log_archive_file + "\n\n";
	
	var message = 
		"To: " + to + "\n" + 
		"From: " + from + "\n" + 
		"Subject: " + subject + "\n" +
		"\n" +  
		body;
	
	mail.send( message, function(err) {
		if (err) console.error( "Mail Error: " + err );
		else verbose("Email sent successfully.\n");
	} );
};
