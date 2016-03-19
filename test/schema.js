var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('Monoxide - schema', function() {
	before(testSetup.init);

	var users;
	it('should get a list of existing users', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.array;
			users = res;
			finish();
		});
	});

	it('should call a static method', function() {
		monoxide.models.users.countByType('users', function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.a.number;
			expect(res).to.be.equal(2);
		});
	});

	it('should call a document method (function return)', function() {
		expect(users[0].splitNames()).to.deep.equal(['Jane', 'Quark']);
	});

	it('should call a document method (callback return)', function(finish) {
		users[0].randomWait(function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.equal(users[0].name);
			finish();
		});
	});
});
