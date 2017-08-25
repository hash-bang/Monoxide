var expect = require('chai').expect;
var mongoose = require('mongoose');
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.save() / monoxideDocument.save()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	var users;
	it('should get a list of existing users', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.instanceOf(Array);
			users = res;
			finish();
		});
	});

	var widgets;
	it('should get a list of existing widgets', function(finish) {
		monoxide.query({
			$collection: 'widgets',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.instanceOf(Array);
			widgets = res;

			// Quick check that we got _id's which are just strings
			widgets.forEach(function(widget) {
				expect(widget._id).to.be.a.string;
				expect(widget._id).to.not.be.an.instanceOf(mongoose.Types.ObjectId);
			});

			finish();
		});
	});

	it('should save a user', function(finish) {
		monoxide.save({
			$collection: 'users',
			$id: users[0]._id,
			name: 'Edited User',
			favourite: widgets[2]._id,
			mostPurchased: [
				{number: 12, item: widgets[0]._id},
				{number: 15, item: widgets[1]._id},
			],
		}, function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.instanceOf(Object);

			expect(user).to.have.property('_id', users[0]._id);
			expect(user).to.have.property('__v', 1);
			expect(user).to.have.property('name', 'Edited User');
			expect(user).to.have.property('role', 'user');
			expect(user).to.have.property('favourite', widgets[2]._id);
			expect(user).to.have.property('mostPurchased');
			expect(user.mostPurchased).to.be.an.instanceOf(Array);
			expect(user.mostPurchased).to.have.length(2);
			expect(user.mostPurchased[0]).to.have.property('number', 12);
			expect(user.mostPurchased[0]).to.have.property('item', widgets[0]._id);
			expect(user.mostPurchased[0].item).to.be.a.string;
			expect(user.mostPurchased[1]).to.have.property('number', 15);
			expect(user.mostPurchased[1]).to.have.property('item', widgets[1]._id);
			expect(user.mostPurchased[1].item).to.be.a.string;

			// Now check that Mongoose returns what SHOULD be stored in the database
			// This mainly checks ObjectIDs have been set properly
			monoxide.models.users.$mongooseModel.findOne({name: 'Edited User'}, function(err, doc) {
				expect(err).to.be.not.ok;

				expect(doc).to.have.property('favourite');
				expect(doc.favourite.toString()).to.be.equal(widgets[2]._id);
				expect(doc.favourite).to.be.an.instanceOf(mongoose.Types.ObjectId);

				expect(doc.mostPurchased).to.be.an.instanceOf(Array);
				expect(doc.mostPurchased).to.have.length(2);

				expect(doc.mostPurchased[0]).to.have.property('item');
				expect(doc.mostPurchased[0].item.toString()).to.be.equal(widgets[0]._id);
				expect(doc.mostPurchased[0].item).to.be.an.instanceOf(mongoose.Types.ObjectId);

				expect(doc.mostPurchased[1]).to.have.property('item');
				expect(doc.mostPurchased[1].item.toString()).to.be.equal(widgets[1]._id);
				expect(doc.mostPurchased[1].item).to.be.an.instanceOf(mongoose.Types.ObjectId);


				finish();
			});
		});
	});

	it('should save a user (via model)', function(finish) {
		users[1].name = 'Edited User2';
		users[1].mostPurchased = [
			{number: 18, item: widgets[1]._id},
			{number: 19, item: widgets[0]._id},
		];
		users[1].save(function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.instanceOf(Object);

			expect(user).to.have.property('_id', users[1]._id);
			expect(user).to.have.property('__v', 1);
			expect(user).to.have.property('name', 'Edited User2');
			expect(user).to.have.property('role', 'user');
			expect(user).to.have.property('favourite');
			expect(user.favourite).to.be.a.string;
			expect(user).to.have.property('mostPurchased');
			expect(user.mostPurchased).to.be.an.instanceOf(Array);
			expect(user.mostPurchased).to.have.length(2);
			expect(user.mostPurchased[0]).to.have.property('number', 18);
			expect(user.mostPurchased[0]).to.have.property('item', widgets[1]._id);
			expect(user.mostPurchased[0].item).to.be.a.string;
			expect(user.mostPurchased[1]).to.have.property('number', 19);
			expect(user.mostPurchased[1]).to.have.property('item', widgets[0]._id);
			expect(user.mostPurchased[1].item).to.be.a.string;

			finish();
		});
	});
});
