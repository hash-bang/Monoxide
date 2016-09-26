var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.query() using $populate', function() {
	before(testSetup.init);
	after(testSetup.teardown);

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
			expect(users[0].items).to.have.length(2);
			expect(users[0].items[0]).to.have.property('name', 'Widget crash');

			expect(users[0]).to.have.property('mostPurchased');
			expect(users[0].mostPurchased).to.be.an.array;
			expect(users[0].mostPurchased).to.have.length(2);
			expect(users[0].mostPurchased[0]).to.have.property('_id');
			expect(users[0].mostPurchased[0].item).to.have.property('name', 'Widget bang');
			expect(users[0].mostPurchased[1]).to.have.property('_id');
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

	// FIXME: Skipped until I can fix this - MC 2016-06-01
	it.skip('should transform OIDs into strings', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
			$populate: [
				{path: 'mostPurchased.item', ref: 'widgets'},
			],
		}, function(err, users) {
			expect(err).to.not.be.ok;
			expect(users).to.be.an.array;

			users.forEach(function(user) {
				// Favourite = OID 1:1
				expect(user).to.have.property('favourite');
				expect(user.favourite).to.be.a.string;
				expect(user.favourite).to.satisfy(_.isString);
				expect(user.favourite).to.not.satisfy(_.isObject);

				// Items = OID 1:M (as array)
				expect(user).to.have.property('items');
				expect(user.items).to.be.an.array;
				user.items.forEach(function(i) {
					expect(i).to.be.a.string;
					expect(i).to.satisfy(_.isString);
					expect(i).to.not.satisfy(_.isObject);
				});

				// mostPurchased = OID 1:M (as collection)
				expect(user).to.have.property('mostPurchased');
				expect(user.mostPurchased).to.be.an.array;
				user.mostPurchased.forEach(function(mp) {
					expect(mp).to.have.property('_id');
					expect(mp._id).to.be.a.string;
					expect(mp._id).to.satisfy(_.isString);
					expect(mp._id).to.not.satisfy(_.isObject);

					expect(mp).to.have.property('item');
					expect(mp.item).to.have.property('_id');
					expect(mp.item._id).to.be.a.string;
					expect(mp.item._id).to.satisfy(_.isString);
					expect(mp.item._id).to.not.satisfy(_.isObject);
				});
			});

			finish();
		});
	});

	it.skip('should support deep population (with population objects)', function(finish) {
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

	it('should support null / undefined values in population', function(finish) {
		monoxide.models.users.findOne({name: 'Jane Quark'}, function(err, user) {
			expect(err).to.be.not.ok;
			user.favourite = undefined;
			user.items = [];
			user.mostPurchased = [];
			user.save(function(err, newUser) {
				expect(err).to.be.not.ok;
				monoxide.models.users
					.findOne({name: 'Jane Quark'})
					.exec(function(err, user) {
						expect(err).to.be.not.ok;
						expect(user).to.have.property('name', 'Jane Quark');

						expect(user).to.have.property('favourite');
						expect(user.favourite).to.be.not.ok;

						expect(user).to.have.property('items');
						expect(user.items).to.have.length(0);

						expect(user).to.have.property('mostPurchased');
						expect(user.mostPurchased).to.have.length(0);

						finish();
					});
			});
		});
	});
});
