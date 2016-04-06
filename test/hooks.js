var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.* (hooks)', function() {
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
		queryHook: 0,
		queryEvent: 0,
		saveHook: 0,
		saveEvent: 0,
		postSaveHook: 0,
		postSaveEvent: 0,
	};
	it('should attach a hooks to users', function() {
		monoxide.models.users
			.hook('query', function(next) {
				firedHooks.queryHook++;
				next();
			})
			.on('query', function(next) {
				firedHooks.queryEvent++;
			})
			.hook('save', function(next, doc) {
				// We should only ever operate on user[0]
				expect(doc._id).to.equal(users[0]._id);
				firedHooks.saveHook++;
				next();
			})
			.on('save', function(next) {
				firedHooks.saveEvent++;
			})
			.hook('postSave', function(next, doc) {
				expect(doc._id).to.equal(users[0]._id);
				firedHooks.postSaveHook++;
				next();
			})
			.on('postSave', function(next) {
				firedHooks.postSaveEvent++;
			})
	});

	it('should fire hooks + events on query', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(firedHooks.queryHook).to.equal(1);
			expect(firedHooks.queryEvent).to.equal(1);
			finish();
		});
	});

	it('should fire hooks on save + postSave', function(finish) {
		users[0].save(function(err, res) {
			expect(firedHooks.saveHook).to.equal(1);
			expect(firedHooks.saveEvent).to.equal(1);
			expect(firedHooks.postSaveHook).to.equal(1);
			expect(firedHooks.postSaveEvent).to.equal(1);
			finish();
		});
	});
});
