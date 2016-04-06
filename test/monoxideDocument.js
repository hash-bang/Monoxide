var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxideDocument.*', function() {
	before(testSetup.init);
	after(testSetup.teardown);

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

	it('should hide methods as prototype functions', function() {
		expect(users[0]).to.have.property('$collection');
		expect(users[0]).to.not.have.ownProperty('$collection');

		expect(users[0]).to.have.property('save');
		expect(users[0]).to.not.have.ownProperty('save');

		expect(users[0]).to.have.property('splitNames');
		expect(users[0]).to.not.have.ownProperty('splitNames');

		expect(users[0]).to.have.property('randomWait');
		expect(users[0]).to.not.have.ownProperty('randomWait');
	});

	it('should pass lodash test (isObject)', function() {
		expect(_.isObject(users[0])).to.be.ok;
	});

	it('should pass lodash test (isPlainObject)', function() {
		expect(_.isPlainObject(users[0])).to.be.ok;
	});

	it('should have enumerable properties', function() {
		expect(Object.keys(users[0])).to.not.include('$collection');
		expect(Object.keys(users[0])).to.not.include('save');
		expect(Object.keys(users[0])).to.not.include('splitNames');
		expect(Object.keys(users[0])).to.not.include('randomWait');
	});

	it('should return sane responses during `for in`', function() {
		var props =[];
		for (var k in users[0]) {
			props.push(k);
		}

		// `for in` should return these things
		expect(props).to.include('$collection');
		expect(props).to.include('save');
		expect(props).to.include('splitNames');
		expect(props).to.include('randomWait');
	});

});
