var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('Monoxide - schema', function() {
	before(testSetup.init);

	it('should call a static method', function() {
		monoxide.models.users.countByType('users', function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.a.number;
			expect(res).to.be.equal(2);
		});
	});

	xit('should call a document method', function() {
		// expect(users[0].splitNames()).to.deep.equal(['Jane', 'Quark']);
	});
});
