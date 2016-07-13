var expect = require('chai').expect;
var objectID = require('mongoose').Types.ObjectId;
var mlog = require('mocha-logger');
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.create() / monoxide.model[].create()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	var widgets;
	it('should get a list of existing widgets', function(finish) {
		monoxide.query({
			$collection: 'widgets',
			$sort: 'name',
			$plain: true, // Force all objects to be plain objects
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.array;
			widgets = res;
			finish();
		});
	});

	it('create a new user (via monoxide.create)', function(finish) {
		monoxide.create({
			$collection: 'users',
			name: 'New User',
			mostPurchased: [
				{number: 50, item: widgets[0]._id},
				{number: 60, item: widgets[1]._id},
			],
			favourite: widgets[2]._id,
			password: 'wonderful',
		}, function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.object;

			mlog.log('created ID', user._id);

			expect(user).to.have.property('name', 'New User');
			expect(user).to.have.property('role', 'user');
			expect(user).to.have.property('_password', 'oeu');
			expect(user).to.have.property('favourite');
			expect(user.favourite).to.be.a.string;
			expect(user).to.have.property('mostPurchased');
			expect(user.mostPurchased).to.be.an.array;
			expect(user.mostPurchased).to.have.length(2);
			expect(user.mostPurchased[0]).to.have.property('number', 50);
			expect(user.mostPurchased[0]).to.have.property('item', widgets[0]._id);
			expect(user.mostPurchased[0].item).to.be.a.string;
			expect(user.mostPurchased[1]).to.have.property('number', 60);
			expect(user.mostPurchased[1]).to.have.property('item', widgets[1]._id);
			expect(user.mostPurchased[1].item).to.be.a.string;

			finish();
		});
	});

	it('should validate the created user (via monoxide.create) against Mongoose return', function(finish) {
		monoxide.models.users.$mongooseModel.findOne({name: 'New User'}, function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.object;
			expect(user).to.have.property('name', 'New User');

			// Validate favourite OID
			expect(user).to.have.property('favourite');
			expect(user.favourite).to.be.an.instanceOf(objectID);

			// Validate items OID
			expect(user).to.have.property('items');
			expect(user.items).to.be.an.array;
			user.items.forEach(function(item) {
				expect(item).to.be.an.instanceOf(objectID);
			});

			// Validate mostpurchased[].item OID
			expect(user.mostPurchased).to.be.an.array;
			expect(user.mostPurchased).to.have.length(2);
			user.mostPurchased.forEach(function(mostPurchased) {
				expect(mostPurchased).to.have.property('item');
				expect(mostPurchased.item).to.be.an.instanceOf(objectID);
			});

			finish();
		});
	});

	it('create a new user (via monoxide.create; without callback)', function() {
		monoxide.create({
			$collection: 'users',
			name: 'New User 2',
			mostPurchased: [
				{number: 50, item: widgets[0]._id},
				{number: 60, item: widgets[1]._id},
			],
			password: 'splendid',
		});
	});

	it('create a new user (via monoxide.model[].create)', function(finish) {
		monoxide.models.users.create({
			name: 'New User2',
			mostPurchased: [
				{number: 80},
				{number: 70},
			],
			password: 'shark', // Should return {_password: 'a'}
		}, function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.object;

			mlog.log('created ID', user._id);

			expect(user).to.have.property('name', 'New User2');
			expect(user).to.have.property('role', 'user');
			expect(user).to.have.property('_password', 'a');
			expect(user).to.have.property('favourite');
			expect(user.favourite).to.be.a.string;
			expect(user).to.have.property('mostPurchased');
			expect(user.mostPurchased).to.be.an.array;
			expect(user.mostPurchased).to.have.length(2);
			expect(user.mostPurchased[0]).to.have.property('number', 80);
			expect(user.mostPurchased[0].item).to.be.undefined;
			expect(user.mostPurchased[1]).to.have.property('number', 70);
			expect(user.mostPurchased[1].item).to.be.undefined;

			finish();
		});
	});

	it('should create omitted fields with defaults', function(finish) {
		monoxide.models.users.create({
			name: 'New User3',
		}, function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.object;

			mlog.log('created ID', user._id);

			expect(user).to.have.property('name', 'New User3');
			expect(user).to.have.property('role', 'user');
			expect(user).to.have.property('favourite');
			expect(user.favourite).to.be.a.string;
			expect(user).to.have.property('mostPurchased');
			expect(user.mostPurchased).to.be.an.array;
			expect(user.mostPurchased).to.have.length(0);
			expect(user).to.have.property('settings');
			expect(user.settings).to.be.an.object;
			expect(user.settings).to.have.property('lang', 'en');
			expect(user.settings).to.have.property('greeting');

			finish();
		});
	});

	it('should not create OIDs if passed null', function(finish) {
		monoxide.models.users.create({
			name: 'New User4',
			favourite: null,
		}, function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.object;

			expect(user).to.have.property('name', 'New User4');
			expect(user).to.have.property('role', 'user');

			expect(user).to.have.property('favourite');
			expect(user.favourite).to.be.null;

			finish();
		});
	});

	it('should not create OIDs if passed undefined', function(finish) {
		monoxide.models.users.create({
			name: 'New User5',
			favourite: undefined,
		}, function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.object;

			expect(user).to.have.property('name', 'New User5');
			expect(user).to.have.property('role', 'user');

			expect(user).to.have.property('favourite');
			expect(user.favourite).to.be.null;

			finish();
		});
	});

	it('should not create OIDs if passed false', function(finish) {
		monoxide.models.users.create({
			name: 'New User6',
			favourite: undefined,
		}, function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.object;

			expect(user).to.have.property('name', 'New User6');
			expect(user).to.have.property('role', 'user');

			expect(user).to.have.property('favourite');
			expect(user.favourite).to.be.null;

			finish();
		});
	});
});
