var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.runCommand()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	it('should be able to run simple runCommand commands', function(finish) {
		monoxide.runCommand({
			distinct: 'users',
			key: 'role',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res.values).to.be.an.instanceOf(Array);
			expect(res.values).to.be.deep.equal(['user']);
			finish();
		});
	});

	it('should be able to run runCommand alias .distinct()', function(finish) {
		monoxide.models.users.distinct('role', function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.instanceOf(Array);
			expect(res).to.be.deep.equal(['user']);
			finish();
		});
	});

});
