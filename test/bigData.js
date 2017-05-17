var async = require('async-chainable');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('big data sets', function() {
	before(testSetup.init);
	before(testSetup.initFriends);
	after(testSetup.teardown);

	var friends;

	it('should retrieve a very big data set', function(finish) {
		this.timeout(120 * 1000);

		monoxide.query({
			$collection: 'friends',
		}, function(err, res) {
			expect(err).to.not.be.ok;
			expect(res).to.have.length(10000);
			friends = res;
			finish();
		});
	});

	it('should be able to scope over each item in parallel', function(finish) {
		this.timeout(120 * 1000);
		async()
			.forEach(friends, function(next, friend) {
				expect(friend).to.have.property('_id');
				expect(friend).to.have.property('name');
				next();
			})
			.end(finish);
	});

	it('should be able to perform simple operations in parallel', function(finish) {
		this.timeout(120 * 1000);
		async()
			.forEach(friends, function(next, friend) {
				friend.username += 'xxx';
				friend.save(next);
			})
			.end(finish);
	});

});
