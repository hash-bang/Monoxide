var expect = require('chai').expect;
var mongoloid = require('..');
var testSetup = require('./setup');

describe('Mongoloid - count', function() {
	before(testSetup.init);

	it('should count the users model', function(finish) {
		mongoloid.count({
			$collection: 'users',
		}, function(err, count) {
			expect(err).to.not.be.ok;

			expect(count).to.be.an.object;
			expect(count).to.have.property('count');
			expect(count.count).to.be.a.number;
			expect(count.count).to.be.equal(2);

			finish();
		});
	});

	it('should count the widgets model', function(finish) {
		mongoloid.count({
			$collection: 'widgets',
		}, function(err, count) {
			expect(err).to.not.be.ok;

			expect(count).to.be.an.object;
			expect(count).to.have.property('count');
			expect(count.count).to.be.a.number;
			expect(count.count).to.be.equal(3);

			finish();
		});
	});
});
