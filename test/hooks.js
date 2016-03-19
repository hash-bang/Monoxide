var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('Monoxide - hooks', function() {
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

	var firedHooks = {
		query: 0,
	};
	it('should attach a hooks to users', function() {
		monoxide.models.users
			.hook('query', function(next) {
				firedHooks.query++;
				next();
			});
	});

	it('should fire hooks on query', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(firedHooks.query).to.equal(1);
			finish();
		});
	});
});
