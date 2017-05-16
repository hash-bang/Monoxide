var async = require('async-chainable');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.query() / monoxide.get() / monoxide.model[].findOne*()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	var users, widgets, groups;

	it('should retrieve all users', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.not.be.ok;
			expect(res).to.be.an.array;
			users = res;

			finish();
		});
	});

	it('should retrieve all widgets', function(finish) {
		monoxide.query({
			$collection: 'widgets',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.not.be.ok;
			expect(res).to.be.an.array;
			widgets = res;

			finish();
		});
	});

	it('should retrieve all groups', function(finish) {
		monoxide.query({
			$collection: 'groups',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.not.be.ok;
			expect(res).to.be.an.array;
			groups = res;

			finish();
		});
	});

	it('should get() all users by ID (strings syntax)', function(finish) {
		async()
			.forEach(users, function(next, user) {
				monoxide.get('users', user._id, function(err, res) {
					expect(err).to.be.not.ok;
					expect(res).to.be.an.object;

					expect(user._id).to.deep.equal(res._id);
					next();
				});
			})
			.end(finish);
	});

	it('should get() all users by ID (object syntax)', function(finish) {
		async()
			.forEach(users, function(next, user) {
				monoxide.get({
					$collection: 'users',
					$id: user._id
				}, function(err, res) {
					expect(err).to.be.not.ok;
					expect(res).to.be.an.object;

					expect(user._id).to.deep.equal(res._id);
					next();
				});
			})
			.end(finish);
	});

	it('should get() all users by ID (via model#findOne)', function(finish) {
		async()
			.forEach(users, function(next, user) {
				monoxide.models.users.findOne({_id: user._id}, function(err, res) {
					expect(err).to.be.not.ok;
					expect(res).to.be.an.object;

					expect(user._id).to.deep.equal(res._id);
					next();
				});
			})
			.end(finish);
	});

	it('should not get() a user by an invalid ID (via model#findOne)', function(finish) {
		monoxide.models.users.findOne({_id: '500000000000000000000000'}, function(err, res) {
			expect(err).to.be.ok;
			expect(res).to.be.undefined;
			finish();
		});
	});

	it('should not get() a user by an invalid ID (via model#findOne + $errNotFound=false)', function(finish) {
		monoxide.models.users.findOne({_id: '500000000000000000000000', $errNotFound: false}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.undefined;
			finish();
		});
	});

	it('should get() all users by ID (via model#findOneByID)', function(finish) {
		async()
			.forEach(users, function(next, user) {
				monoxide.models.users.findOneByID(user._id, function(err, res) {
					expect(err).to.be.not.ok;
					expect(res).to.be.an.object;

					expect(user._id).to.deep.equal(res._id);
					next();
				});
			})
			.end(finish);
	});

	it('should not get() a user by an invalid ID (via model#findOneByID)', function(finish) {
		monoxide.models.users.findOneByID('500000000000000000000000', function(err, res) {
			expect(err).to.be.ok;
			expect(res).to.be.undefined;
			finish();
		});
	});

	it('should not get() a user by an invalid ID (via model#findOneByID + optional())', function(finish) {
		monoxide.models.users
			.findOneByID('500000000000000000000000')
			.optional()
			.exec(function(err, res) {
				expect(err).to.be.not.ok;
				expect(res).to.be.undefined;
				finish();
			});
	});

	it('should get() all widgets by ID', function(finish) {
		async()
			.forEach(widgets, function(next, widget) {
				monoxide.get('widgets', widget._id, function(err, res) {
					expect(err).to.be.not.ok;
					expect(res).to.be.an.object;

					expect(widget._id).to.deep.equal(res._id);
					next();
				});
			})
			.end(finish);
	});

	it('should get() all groups by ID', function(finish) {
		async()
			.forEach(groups, function(next, group) {
				monoxide.get('groups', group._id, function(err, res) {
					expect(err).to.be.not.ok;
					expect(res).to.be.an.object;

					expect(res._id).to.deep.equal(res._id);
					next();
				});
			})
			.end(finish);
	});

	it('should not get() an invalid ID', function(finish) {
		monoxide.get('users', '500000000000000000000000', function(err, res) {
			expect(err).to.be.ok;
			expect(res).to.be.undefined;
			finish();
		});
	});
});
