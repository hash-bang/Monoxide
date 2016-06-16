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

	it('should hide custom methods as prototype functions', function() {
		['splitNames', 'randomWait'].forEach(function(prop) {
			expect(users[0]).to.have.property(prop);
			expect(users[0]).to.not.have.ownProperty(prop);
		});
	});

	it('should hide monoxide methods as prototype functions', function() {
		[
			// Properties
			'$MONOXIDE', '$collection', '$populated',

			// Methods
			'save', 'remove', 'omit', 'toObject', 'toMongoObject', 'isModified', 'populate', 'getNodesBySchemaPath', 'getOIDs',
		].forEach(function(prop) {
			expect(users[0]).to.have.property(prop);
			expect(users[0]).to.not.have.ownProperty(prop);
		});
	});

	it('should pass lodash test (isObject)', function() {
		expect(_.isObject(users[0])).to.be.ok;
	});

	it.skip('should pass lodash test (isPlainObject)', function() {
		expect(_.isPlainObject(users[0])).to.be.ok;
	});

	it('should return an un-prototyped object via toObject()', function() {
		var asObj = users[0].toObject();

		[
			// Custom methods
			'splitNames', 'randomWait',

			// Properties
			'$MONOXIDE', '$collection', '$populated',

			// Methods
			'save', 'remove', 'omit', 'toObject', 'toMongoObject', 'isModified', 'populate', 'getNodesBySchemaPath', 'getOIDs',
		].forEach(function(prop) {
			expect(asObj).to.not.have.property(prop);
		});
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
