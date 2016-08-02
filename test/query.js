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

	it('should query by a sub-document array of OIDs ($in)', function(finish) {
		monoxide.query({
			$collection: 'widgets',
			$sort: 'created',
		}, function(err, widgets) {
			expect(err).to.be.not.ok;
			expect(widgets).to.be.an.array;

			monoxide.query({
				$collection: 'users',
				items: {$in: [widgets[0]._id]},
			}, function(err, users) {
				expect(err).to.not.be.ok;
				expect(users).to.be.an.array;
				expect(users).to.have.length(1);

				expect(users[0]).to.have.property('items');
				expect(users[0].items[0].toString()).to.equal(widgets[0]._id);

				finish();
			});
		});
	});

	it('should query by a sub-document array of OIDs ($nin)', function(finish) {
		monoxide.query({
			$collection: 'widgets',
			$sort: 'created',
		}, function(err, widgets) {
			expect(err).to.be.not.ok;
			expect(widgets).to.be.an.array;

			monoxide.query({
				$collection: 'users',
				items: {$nin: [ widgets[0]._id, widgets[2]._id] },
			}, function(err, users) {
				expect(err).to.not.be.ok;
				expect(users).to.be.an.array;
				expect(users).to.have.length(0);

				finish();
			});
		});
	});

	it('should be able to return undecorated objects (.query($decorate=false))', function(finish) {
		monoxide.query({
			$decorate: false,
			$collection: 'widgets',
			$sort: 'created',
		}, function(err, widgets) {
			expect(err).to.be.not.ok;
			expect(widgets).to.be.an.array;

			widgets.forEach(function(widget) {
				[
					// Custom methods
					'splitNames', 'randomWait',

					// Properties
					'$MONOXIDE', '$collection', '$populated',

					// Methods
					'save', 'remove', 'omit', 'toObject', 'toMongoObject', 'isModified', 'populate', 'getNodesBySchemaPath', 'getOIDs',
				].forEach(function(prop) {
					expect(widget).to.not.have.property(prop);
				});

				expect(widget).to.satisfy(_.isObject);
				expect(widget).to.satisfy(_.isPlainObject);
			});

			finish();
		});
	});

	it('should be able to query via a collection array', function(finish) {
		monoxide.models.widgets.findOne({name: 'Widget bang'}, function(err, widget) {
			expect(err).to.be.not.ok;
			expect(widget).to.be.an.object;
			expect(widget).to.have.property('name', 'Widget bang');

			monoxide.models.users.find({
				$collection: 'users',
				$sort: 'name',
				'mostPurchased.item': widget._id,
			}, function(err, users) {
				expect(err).to.not.be.ok;
				expect(users).to.be.an.array;
				expect(users).to.have.length(2);
				finish();
			});
		});
	});

	it('should be able to query via an array of IDs', function(finish) {
		monoxide.models.widgets.findOne({name: 'Widget bang'}, function(err, widget) {
			expect(err).to.be.not.ok;
			expect(widget).to.be.an.object;
			expect(widget).to.have.property('name', 'Widget bang');

			monoxide.models.users.find({
				$collection: 'users',
				$sort: 'name',
				items: {$in: [widget._id]},
			}, function(err, users) {
				expect(err).to.not.be.ok;
				expect(users).to.be.an.array;
				expect(users).to.have.length(1);
				finish();
			});
		});
	});

	it('should perform a plain query ($plain=true)', function(finish) {
		monoxide.models.users.findOne({
			$plain: true,
			name: 'Joe Random',
		}, function(err, user) {
			expect(err).to.be.not.ok;
			expect(user).to.be.an.object;
			expect(user).to.have.property('name', 'Joe Random');

			// Validate that 1:1 OIDs are plain strings
			expect(user).to.have.property('favourite');
			expect(user.favourite).to.be.a.string;
			expect(user.favourite).to.satisfy(_.isString);

			// Validate 1:M OIDs are plain strings
			expect(user).to.have.property('items');
			expect(user.items).to.be.an.array;
			user.items.forEach(function(item) {
				expect(item).to.be.a.string;
				expect(item).to.satisfy(_.isString);
			});

			// Validate 1:M (collection) OIDs are plain strings
			expect(user).to.have.property('mostPurchased');
			expect(user.mostPurchased).to.be.an.array;
			user.mostPurchased.forEach(function(mostPurchased) {
				expect(mostPurchased).to.have.property('item');
				expect(mostPurchased.item).to.be.a.string;
				expect(mostPurchased.item).to.satisfy(_.isString);
			});

			finish();
		});
	});
});
