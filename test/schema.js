var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('Monoxide - schema', function() {
	before(testSetup.init);

	var users;
	it('should get all users', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.not.be.ok;
			expect(res).to.be.an.array;
			users = res;
			finish();
		});
	});

	it('should call a static method', function() {
		expect(users[0].splitNames()).to.deep.equal(['Jane', 'Quark']);
	});
});
