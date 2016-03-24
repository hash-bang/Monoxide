var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('Monoxide - hooks', function() {
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

	var firedHooks = {
		query: 0,
		save: 0,
		postSave: 0,
	};
	it('should attach a hooks to users', function() {
		monoxide.models.users
			.hook('query', function(next) {
				firedHooks.query++;
				next();
			})
			.hook('save', function(next, doc) {
				// We should only ever operate on user[0]
				expect(doc._id).to.equal(users[0].$id);
				firedHooks.save++;
				next();
			})
			.hook('postSave', function(next, doc) {
				expect(doc._id).to.equal(users[0].$id);
				firedHooks.postSave++;
				next();
			})
	});

	it('should fire hooks on query', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(firedHooks.query).to.equal(1);
			finish();
		});
	});

	it('should fire hooks on save + postSave', function(finish) {
		users[0].save(function(err, res) {
			expect(firedHooks.save).to.equal(1);
			expect(firedHooks.postSave).to.equal(1);
			finish();
		});
	});
});
