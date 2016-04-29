var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxideDocument.getFKNodes()', function() {
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

	it('should correctly traverse all OIDs', function() {
		var schemaPaths = [];
		var docPaths = [];

		var nodes = users[0].getFKNodes();
		expect(nodes).to.be.an.array;

		nodes.forEach(function(node) {
			schemaPaths.push(node.schemaPath);
			docPaths.push(node.docPath);
		});

		schemaPaths = _.uniq(schemaPaths);

		expect(schemaPaths).to.include('_id');
		expect(docPaths).to.include('_id');

		expect(schemaPaths).to.include('mostPurchased._id');
		expect(docPaths).to.include('mostPurchased.0._id');
		expect(docPaths).to.include('mostPurchased.1._id');

		expect(schemaPaths).to.include('mostPurchased.item');
		expect(docPaths).to.include('mostPurchased.0.item');
		expect(docPaths).to.include('mostPurchased.1.item');

		expect(schemaPaths).to.include('favourite');
		expect(docPaths).to.include('favourite');

		expect(schemaPaths).to.include('items');
		expect(docPaths).to.include('items.0');

		expect(schemaPaths).to.have.length(6);
		expect(docPaths).to.have.length(8);
	});
});
