Page.Verify = class Verify extends Page.Base {
	
	onInit() {
		// called once at page load
	}
	
	onActivate(args) {
		// page activation
		var self = this;
		app.setWindowTitle('Email Verification');
		app.setHeaderTitle( '' );
		app.showSidebar(false);
		
		this.div.html('<div class="loading_container"><div class="loading"></div></div>');
		
		app.api.get( 'app/verify_email', args, this.receiveVerification.bind(this), this.fullPageError.bind(this) );
		
		return true;
	}
	
	receiveVerification(resp) {
		// user is now verified!  redirect to login and show overlay message
		Nav.go('RecentNew');
		app.showMessage('success', "Your e-mail address has been successfully verified.  You can now post topics and replies.");
	}
	
	onDeactivate() {
		// called when page is deactivated
		this.div.html( '' );
		return true;
	}
	
};
