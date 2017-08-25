var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.query() using $select', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	it('should select only certain fields', function(finish) {
		monoxide.query({
			$collection: 'widgets',
			$sort: 'created',
			$select: ['_id', 'name', 'color'],
		}, function(err, widgets) {
			expect(err).to.be.not.ok;
			expect(widgets).to.be.an.instanceOf(Array);
			expect(widgets).to.have.length(3);
			widgets.forEach(function(w) {
				expect(w).to.have.property('_id');
				expect(w).to.not.have.property('created');
				expect(w).to.have.property('name');
				expect(w).to.not.have.property('content');
				expect(w).to.not.have.property('status');
				expect(w).to.have.property('color');
			});
			finish();
		});
	});

	it('should omit certain fields', function(finish) {
		monoxide.query({
			$collection: 'widgets',
			$sort: 'created',
			$select: ['-name', '-content'],
		}, function(err, widgets) {
			expect(err).to.be.not.ok;
			expect(widgets).to.be.an.instanceOf(Array);
			expect(widgets).to.have.length(3);
			widgets.forEach(function(w) {
				expect(w).to.have.property('_id');
				expect(w).to.have.property('created');
				expect(w).to.not.have.property('name');
				expect(w).to.not.have.property('content');
				expect(w).to.have.property('status');
				expect(w).to.have.property('color');
			});
			finish();
		});
	});

	// FIXME: This doens't work yet - MC 2016-06-01
	it.skip('should only return deeply nested fields', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'created',
			$select: ['name', 'mostPurchased.number', 'mostPurchased.item', 'mostPurchased.item.name', 'mostPurchased.item.color'],
			$populate: 'mostPurchased.item',
		}, function(err, users) {
			expect(err).to.be.not.ok;
			expect(users).to.be.an.instanceOf(Array);
			expect(users).to.have.length(2);
			users.forEach(function(u) {
				//expect(u).to.not.have.property('_id');
				expect(u).to.have.property('name');
				expect(u).to.not.have.property('role');
				expect(u).to.not.have.property('favourite');
				expect(u).to.not.have.property('items');
				expect(u).to.not.have.property('_password');

				expect(u).to.have.property('mostPurchased');
				u.mostPurchased.forEach(function(mp) {
					expect(mp).to.have.property('number');
					expect(mp.item).to.not.have.property('_id');
					expect(mp.item).to.not.have.property('created');
					expect(mp.item).to.have.property('name');
					expect(mp.item).to.not.have.property('content');
					expect(mp.item).to.have.property('color');
				});
			});
			finish();
		});
	});

	it('should omit deeply nested fields', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'created',
			$select: ['-mostPurchased.item'],
		}, function(err, users) {
			expect(err).to.be.not.ok;
			expect(users).to.be.an.instanceOf(Array);
			expect(users).to.have.length(2);
			users.forEach(function(u) {
				expect(u).to.have.property('_id');
				expect(u).to.have.property('name');
				expect(u).to.have.property('role');
				expect(u).to.have.property('favourite');
				expect(u).to.have.property('items');
				expect(u).to.have.property('_password');

				expect(u).to.have.property('mostPurchased');
				u.mostPurchased.forEach(function(mp) {
					expect(mp).to.have.property('number');
					expect(mp).to.not.have.property('item');
				});
			});
			finish();
		});
	});
});
