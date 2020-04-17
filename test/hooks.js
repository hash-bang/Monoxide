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
			expect(res).to.be.an('array');
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
			.hook('query', function(next, q, d) {
				//expect(q).to.have.property('$data');
				//expect(q.$data).to.be.deep.equal({foo: 'bar', baz: 123});

				firedHooks.queryHook++;
				next();
			})
			.on('query', function(next) {
				firedHooks.queryEvent++;
			})
			.hook('save', function(next, q) {
				expect(q).to.have.property('$data');
				expect(q.$data).to.be.deep.equal({foo: 'bar', baz: 123});

				// We should only ever operate on user[0]
				expect(q._id).to.equal(users[0]._id);
				firedHooks.saveHook++;
				next();
			})
			.on('save', function(next) {
				firedHooks.saveEvent++;
			})
			.hook('postSave', function(next, q, doc) {
				expect(q).to.have.deep.property('$data');
				expect(q.$data).to.be.deep.equal({foo: 'bar', baz: 123});

				expect(doc).to.have.property('isModified'); // Check for a random Monoxide function
				expect(doc.isModified).to.be.a('function');

				// FIXME: Did _id change from string to ObjectId?
				expect(q._id.toString()).to.equal(users[0]._id);
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
			$data: {foo: 'bar', baz: 123},
			$sort: 'name',
		}, function(err, res) {
			expect(firedHooks.queryHook).to.equal(1);
			expect(firedHooks.queryEvent).to.equal(1);
			finish();
		});
	});

	it('should fire hooks on save + postSave', function(finish) {
		users[0].save({$data: {foo: 'bar', baz: 123}}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(firedHooks.saveHook).to.equal(1);
			expect(firedHooks.saveEvent).to.equal(1);
			expect(firedHooks.postSaveHook).to.equal(1);
			expect(firedHooks.postSaveEvent).to.equal(1);
			finish();
		});
	});
});
