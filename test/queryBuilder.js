var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.queryBuilder', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	var users;
	it('should query the users model', function(finish) {
		monoxide.model('users')
			.find()
			.sort('name')
			.populate('items')
			.populate('mostPurchased.item')
			.exec(function(err, res) {
				expect(err).to.not.be.ok;

				users = res;
				expect(users).to.be.an('array');
				expect(users).to.have.length(2);

				expect(users[0]).to.have.property('name', 'Jane Quark');
				expect(users[0]).to.have.property('role', 'user');
				expect(users[0]).to.have.property('favourite');
				expect(users[0].favourite).to.be.a('string');
				expect(users[0]).to.have.property('mostPurchased');
				expect(users[0].mostPurchased).to.be.an('array');
				expect(users[0].mostPurchased).to.have.length(2);
				expect(users[0].mostPurchased[0]).to.have.property('number', 1);
				expect(users[0].mostPurchased[1]).to.have.property('number', 2);

				expect(users[1]).to.have.property('name', 'Joe Random');
				expect(users[1]).to.have.property('role', 'user');
				expect(users[1]).to.have.property('favourite');
				expect(users[1].mostPurchased).to.be.an('array');
				expect(users[1].mostPurchased).to.have.length(3);
				expect(users[1].mostPurchased[0]).to.have.property('number', 5);
				expect(users[1].mostPurchased[1]).to.have.property('number', 10);
				expect(users[1].mostPurchased[2]).to.have.property('number', 15);

				finish();
			});
	});


	it('should query the widgets model', function(finish) {
		monoxide.models.widgets
			.find({color: 'blue'})
			.sort(['-name'])
			.exec(function(err, widgets) {
				expect(err).to.not.be.ok;
				expect(widgets).to.be.an('array');
				expect(widgets).to.have.length(2);

				expect(widgets[0]).to.have.property('name', 'Widget whollop');
				expect(widgets[0]).to.have.property('color', 'blue');

				expect(widgets[1]).to.have.property('name', 'Widget crash');
				expect(widgets[1]).to.have.property('color', 'blue');

				finish();
			});
	});


	it('should query the widgets model (find + callback)', function(finish) {
		monoxide.models.widgets.find({color: 'blue'}, function(err, widgets) {
			expect(err).to.not.be.ok;
			expect(widgets).to.be.an('array');
			expect(widgets).to.have.length(2);

			finish();
		});
	});


	it('should query the widgets model (w/select)', function(finish) {
		monoxide.models.widgets.find({color: 'blue'})
			.select(['_id', 'color'])
			.exec(function(err, widgets) {
				expect(err).to.not.be.ok;

				expect(widgets).to.be.an('array');
				expect(widgets).to.have.length(2);

				expect(_.keys(widgets[0]).sort()).to.deep.equal(['_id', 'color']);

				finish();
			});
	});


	it('should query the users model via findOne', function(finish) {
		monoxide.models.users
			.findOne({_id: users[0]._id})
			.exec(function(err, user) {
				expect(err).to.not.be.ok;
				expect(user).to.be.an('object');

				expect(user._id).to.deep.equal(users[0]._id);
				expect(user).to.have.property('name', users[0].name);

				finish();
			});
	});

	it('should query the users model via findOne + callback', function(finish) {
		monoxide.models.users.findOne({_id: users[0]._id}, function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an('object');

			expect(user._id).to.deep.equal(users[0]._id);
			expect(user).to.have.property('name', users[0].name);

			finish();
		});
	});


	it('should query the users model via findOneByID', function(finish) {
		monoxide.models.users
			.findOneByID(users[0]._id.toString())
			.exec(function(err, user) {
				expect(err).to.not.be.ok;
				expect(user).to.be.an('object');

				expect(user).to.have.property('name', users[0].name);

				finish();
			});
	});
});
