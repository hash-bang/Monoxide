var _ = require('lodash');
var expect = require('chai').expect;
var sinon = require('sinon');
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.utilities.extractFKs()', function() {
	before(testSetup.init);
	after(testSetup.teardown);
	
	it('should extract pointers', function() {
		var keys = monoxide.utilities.extractFKs(monoxide.models.users.$mongooseModel.schema);

		expect(keys).to.have.property('favourite').that.is.an('object');
		expect(keys).to.have.property('items').that.is.an('object');
		expect(keys).to.have.property('mostPurchased').that.is.an('object');
		expect(keys).to.have.property('mostPurchased.item').that.is.an('object');
		expect(keys).to.have.property('mostPurchased._id').that.is.an('object');
		expect(keys).to.have.property('settings.featured').that.is.an('object');
		expect(keys).to.have.property('_id').that.is.an('object');
	});

	it('should contain the type of object', function() {
		var keys = monoxide.utilities.extractFKs(monoxide.models.users.$mongooseModel.schema);

		expect(keys.favourite.type).to.equal('objectId');
		expect(keys.items.type).to.equal('objectIdArray');
		expect(keys.mostPurchased.type).to.equal('subDocument');
		expect(keys['mostPurchased.item'].type).to.equal('objectId');
		expect(keys['mostPurchased._id'].type).to.equal('objectId');
		expect(keys['settings.featured'].type).to.equal('objectId');
		expect(keys._id.type).to.equal('objectId');
	});

});

describe('monoxide.utilities.mapSchemaPath()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	it('should invoke the callback', function() {
		var spy = sinon.spy();
		var keys = monoxide.utilities.extractFKs(monoxide.models.users.$mongooseModel.schema);
		monoxide.utilities.mapSchemaPath(keys, 'favourite', spy);
		sinon.assert.calledOnce(spy);
	});

	it('should traverse through object', function() {
		var keys = monoxide.utilities.extractFKs(monoxide.models.users.$mongooseModel.schema);

		monoxide.utilities.mapSchemaPath(keys, 'favourite', function(endpointValue, endpointPath) {
			expect(endpointValue).to.be.an('object');
			expect(endpointValue).to.have.property('type').to.equal('objectId');
			expect(endpointPath).to.be.an('array').that.does.include('favourite');
			expect(endpointPath).to.have.length(1);
		});

		monoxide.utilities.mapSchemaPath(keys, 'items', function(endpointValue, endpointPath) {
			expect(endpointValue).to.be.an('object');
			expect(endpointValue).to.have.property('type').to.equal('objectIdArray');
			expect(endpointPath).to.be.an('array').that.does.include('items');
			expect(endpointPath).to.have.length(1);
		});

		monoxide.utilities.mapSchemaPath(keys, 'mostPurchased.item', function(endpointValue, endpointPath) {
			expect(endpointValue).to.be.undefined;
			expect(endpointPath).to.be.an('array').that.does.include('mostPurchased');
			expect(endpointPath).to.be.an('array').that.does.include('item');
			expect(endpointPath).to.have.length(2);
		});

		monoxide.utilities.mapSchemaPath(keys, 'mostPurchased._id', function(endpointValue, endpointPath) {
			expect(endpointValue).to.be.undefined;
			expect(endpointPath).to.be.an('array').that.does.include('mostPurchased');
			expect(endpointPath).to.be.an('array').that.does.include('_id');
			expect(endpointPath).to.have.length(2);
		});
	});
});