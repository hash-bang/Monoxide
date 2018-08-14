var async = require('async-chainable');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe.skip('big data sets', function() {
	before(()=> monoxide.use('iterators'));
	before(testSetup.init);
	before(testSetup.initFriends);
	after(testSetup.teardown);

	it('should retrieve a very big data set into an array', function(done) {
		this.timeout(120 * 1000);

		monoxide.query({
			$collection: 'friends',
		}, function(err, res) {
			expect(err).to.not.be.ok;
			expect(res).to.have.length(10000);
			done();
		});
	});

	it('should be able to scope over each item in parallel using iterators', function(done) {
		this.timeout(120 * 1000);

		var found = 0;
		monoxide.models.friends
			.find()
			.forEach((next, friend) => {
				found++;
				expect(friend).to.have.property('_id');
				expect(friend).to.have.property('name');
				next();
			})
			.exec(()=> {
				expect(found).to.be.equal(10000);
				done();
			});
	});

});
