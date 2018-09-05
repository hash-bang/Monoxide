var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.schema()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	var users;
	it('should get a list of existing users', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an('array');
			users = res;
			finish();
		});
	});

	it('should call a static method', function() {
		monoxide.models.users.countByType('user', function(err, res) {
			expect(err).to.be.not.ok;
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

	it('should set via a virtual', function() {
		users[0].password = 'helloworld'; // Password should be mangled into removing non-vowels
		expect(users[0]._password).to.equal('eoo');
	});

	it('should get via a virtual', function() {
		expect(users[0].password).to.equal('RESTRICTED');
		expect(users[0].passwordStrength).to.equal(3);
	});

	it('should be able to access a custom schema properties', function() {
		expect(monoxide).to.have.nested.property('models.users.$schema.role.customBool', true);
		expect(monoxide).to.have.nested.property('models.users.$schema.settings.lang.customNumber', 123);

		expect(monoxide).to.have.nested.property('models.widgets.$schema.color.customArray');
		expect(monoxide.models.widgets.$schema.color.customArray).to.deep.equal([1, 2, 3]);

		expect(monoxide).to.have.nested.property('models.widgets.$schema.featured.customObject');
		expect(monoxide.models.widgets.$schema.featured.customObject).to.deep.equal({foo: 'Foo!', bar: 'Bar!'});
	});
});
