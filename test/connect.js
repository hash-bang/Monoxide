var expect = require('chai').expect;
var mlog = require('mocha-logger');
var monoxide = require('..');
var testSetup = require('./setup');

describe.skip('monoxide.connect()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	it('should run a simple query in loop (and error gracefully when Mongo isnt running)', function(finish) {
		this.timeout(0);

		var attempt = 1;

		mlog.log('A query will be run every second for 30 seconds');
		mlog.log('PLEASE STOP THE MONGO PROCESS DURING THIS TEST');

		var queryLoop = function() {
			mlog.log(`Querying user model #${attempt}...`);
			monoxide.count('users', function(err, count) {
				expect(err).to.not.be.ok;

				expect(count).to.be.equal(2);

				if (attempt++ > 10) return finish();

				setTimeout(queryLoop, 1000);
			});
		};

		queryLoop();
	});
});
