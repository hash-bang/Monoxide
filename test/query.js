var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.query()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	it('should query the users model', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, users) {
			expect(err).to.not.be.ok;
			expect(users).to.be.an.array;

			expect(users[0]).to.have.property('_id');
			expect(users[0]._id).to.be.a.string;
			expect(users[0]).to.have.property('name', 'Jane Quark');
			expect(users[0]).to.have.property('role', 'user');
			expect(users[0]).to.have.property('favourite');
			expect(users[0].favourite).to.be.a.string;
			expect(users[0]).to.have.property('mostPurchased');
			expect(users[0].mostPurchased).to.be.an.array;
			expect(users[0].mostPurchased).to.have.length(2);
			expect(users[0].mostPurchased[0]).to.have.property('number', 1);
			expect(users[0].mostPurchased[0].item).to.be.a.string;
			expect(users[0].mostPurchased[1]).to.have.property('number', 2);
			expect(users[0].mostPurchased[1].item).to.be.a.string;

			expect(users[1]).to.have.property('_id');
			expect(users[1]._id).to.be.a.string;
			expect(users[1]).to.have.property('name', 'Joe Random');
			expect(users[1]).to.have.property('role', 'user');
			expect(users[1]).to.have.property('favourite');
			expect(users[1].mostPurchased).to.be.an.array;
			expect(users[1].mostPurchased).to.have.length(3);
			expect(users[1].mostPurchased[0]).to.have.property('number', 5);
			expect(users[1].mostPurchased[0].item).to.be.a.string;
			expect(users[1].mostPurchased[1]).to.have.property('number', 10);
			expect(users[1].mostPurchased[1].item).to.be.a.string;
			expect(users[1].mostPurchased[2]).to.have.property('number', 15);
			expect(users[1].mostPurchased[2].item).to.be.a.string;

			finish();
		});
	});

	it('should count the returns from users model (via query())', function(finish) {
		monoxide.query({
			$collection: 'users',
			$count: true,
		}, function(err, res) {
			expect(err).to.not.be.ok;
			expect(res).to.be.a.number;
			expect(res).to.be.equal(2);

			finish();
		});
	});

	it('should support population', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
			$populate: [
				{path: 'favourite', ref: 'widgets'},
				{path: 'items', ref: 'widgets'},
				{path: 'mostPurchased.item', ref: 'widgets'},
			],
		}, function(err, users) {
			expect(err).to.not.be.ok;
			expect(users).to.be.an.array;

			expect(users[0]).to.have.property('favourite');
			expect(users[0].favourite).to.be.an.object;
			expect(users[0].favourite).to.have.property('name', 'Widget bang');

			expect(users[0]).to.have.property('items');
			expect(users[0].items).to.be.an.array;
			expect(users[0].items).to.have.length(1);
			expect(users[0].items[0]).to.have.property('name', 'Widget bang');

			expect(users[0]).to.have.property('mostPurchased');
			expect(users[0].mostPurchased).to.be.an.array;
			expect(users[0].mostPurchased).to.have.length(2);
			expect(users[0].mostPurchased[0]).to.have.property('number', 1);
			expect(users[0].mostPurchased[0].item).to.have.property('name', 'Widget bang');
			expect(users[0].mostPurchased[1]).to.have.property('number', 2);
			expect(users[0].mostPurchased[1]).to.have.property('item')
			expect(users[0].mostPurchased[1].item).to.have.property('name', 'Widget whollop');

			finish();
		});
	});

	it.skip('should complain when being given an invalid population path', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
			$populate: [
				{path: 'favourite', ref: 'widgets'},
				{path: 'itemsXXX', ref: 'widgets'},
				{path: 'mostPurchased.item', ref: 'widgets'},
			],
		}, function(err) {
			expect(err).to.be.ok;

			finish();
		});
	});

	it('should support deep population (with population objects)', function(finish) {
		monoxide.query({
			$collection: 'groups',
			$sort: 'name',
			$populate: [
				{path: 'users.favourite', ref: 'widgets'},
				{path: 'users.items', ref: 'widgets'},
				{path: 'users.mostPurchased.item', ref: 'widgets'},
				{path: 'users', ref: 'users'},
				{path: 'users.mostPurchased.item', ref: 'widgets'},
				{path: 'preferences.defaults.items', ref: 'widgets'},
			],
		}, function(err, groups) {
			expect(err).to.not.be.ok;
			expect(groups).to.be.an.array;
			expect(groups).to.have.length(3);

			var group = groups[0];
			expect(group).to.have.property('name', 'Group Bar');

			expect(group).to.have.property('preferences');
			expect(group.preferences).to.have.property('defaults');
			expect(group.preferences.defaults).to.have.property('items');
			expect(group.preferences.defaults.items).to.be.an.array;
			expect(group.preferences.defaults.items).to.have.length(2);
			expect(group.preferences.defaults.items[0]).to.have.property('name', 'Widget crash');
			expect(group.preferences.defaults.items[1]).to.have.property('name', 'Widget bang');

			expect(group).to.have.property('users');
			expect(group.users).to.have.length(1);
			expect(group.users[0]).to.have.property('name', 'Jane Quark');
			var user = group.users[0];
			expect(user).to.have.property('mostPurchased');
			expect(user.mostPurchased).to.be.an.array;
			expect(user.mostPurchased).to.have.length(2);
			expect(user.mostPurchased[0]).to.have.property('number', 1);
			expect(user.mostPurchased[0].item).to.have.property('name', 'Widget bang');
			expect(user.mostPurchased[1]).to.have.property('number', 2);
			expect(user.mostPurchased[1]).to.have.property('item')
			expect(user.mostPurchased[1].item).to.have.property('name', 'Widget whollop');

			finish();
		});
	});

	it('should query the widgets model, sorting by creation date', function(finish) {
		monoxide.query({
			$collection: 'widgets',
			$sort: 'created',
		}, function(err, widgets) {
			expect(err).to.not.be.ok;
			expect(widgets).to.be.an.array;

			var widgetsSorted = _.sortBy(widgets, 'created');

			widgetsSorted.forEach(function(sortedWidget, index) {
				expect(widgets[index]._id).to.equal(sortedWidget._id);
			});

			finish();
		});
	});

	it('should query by a sub-document array of OIDs', function(finish) {
		monoxide.query({
			$collection: 'widgets',
			$sort: 'created',
		}, function(err, widgets) {
			expect(err).to.be.not.ok;
			expect(widgets).to.be.an.array;

			monoxide.query({
				$collection: 'users',
				items: widgets[0]._id,
			}, function(err, users) {
				expect(err).to.not.be.ok;
				expect(users).to.be.an.array;
				expect(users).to.have.length(2);

				expect(users[0]).to.have.property('items');
				expect(users[0].items[0].toString()).to.equal(widgets[0]._id);

				finish();
			});
		});
	});
});
