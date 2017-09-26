var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxideModel.set() / monoxideModel.get()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	it('should set simple user data', function() {
		monoxide.models.users
			.set('foo', 'Foo!')
			.set('bar', 123)
			.set('baz', false)
	});

	it('should get simple user data', function() {
		expect(monoxide.models.users.get('foo')).to.equal('Foo!');
		expect(monoxide.models.users.get('bar')).to.equal(123);
		expect(monoxide.models.users.get('baz')).to.equal(false);
		expect(monoxide.models.users.get('quz', 'fallback')).to.equal('fallback');
		expect(monoxide.models.users.get('quzz')).to.equal(undefined);
	});

});
