var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.count()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	it('should count the users model', function(finish) {
		monoxide.count('users', function(err, count) {
			expect(err).to.not.be.ok;

			expect(count).to.be.equal(2);

			finish();
		});
	});

	it('should count the widgets model', function(finish) {
		monoxide.count('widgets', function(err, count) {
			expect(err).to.not.be.ok;

			expect(count).to.be.equal(3);

			finish();
		});
	});

	it('should count the widgets model (with filter)', function(finish) {
		monoxide.count({
			$collection: 'widgets',
			color: 'blue',
		}, function(err, count) {
			expect(err).to.not.be.ok;

			expect(count).to.be.equal(2);

			finish();
		});
	});

	it('should count the widgets model (with non-matching)', function(finish) {
		monoxide.count({
			$collection: 'widgets',
			color: 'orange',
		}, function(err, count) {
			expect(err).to.not.be.ok;

			expect(count).to.be.equal(0);

			finish();
		});
	});
});
