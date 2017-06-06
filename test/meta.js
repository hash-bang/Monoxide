var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.meta()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	it('should get the meta information of the users model', function(finish) {
		monoxide.meta({
			$collection: 'users',
		}, function(err, meta) {
			expect(err).to.not.be.ok;
			expect(meta).to.be.an.object;

			expect(meta).to.have.property('name');
			expect(meta.name).to.have.property('type', 'string');

			expect(meta).to.have.property('role');
			expect(meta.role).to.have.property('type', 'string');
			expect(meta.role).to.have.property('default', 'user');
			expect(meta.role).to.have.property('enum');
			expect(meta.role.enum).to.be.deep.equal(['user', 'admin']);

			expect(meta).to.not.have.property('_password');

			expect(meta).to.have.property('favourite');
			expect(meta.favourite).to.have.property('type', 'objectid');
			expect(meta.favourite).to.have.property('ref', 'widgets');

			expect(meta).to.have.property('items');
			expect(meta.items).to.have.property('type', 'array');

			expect(meta).to.have.property('mostPurchased');
			expect(meta.mostPurchased).to.have.property('type', 'array');

			expect(meta).to.have.property('settings.lang');
			expect(meta['settings.lang']).to.have.property('type', 'string');
			expect(meta['settings.lang']).to.have.property('default', 'en');
			expect(meta['settings.lang']).to.have.property('enum');
			expect(meta['settings.lang'].enum).to.be.deep.equal(['en', 'es', 'fr', 'elmerFudd']);

			finish();
		});
	});

	it('should get the meta information of the widgets model', function(finish) {
		monoxide.meta({
			$collection: 'widgets',
		}, function(err, meta) {
			expect(err).to.not.be.ok;
			expect(meta).to.be.an.object;

			expect(meta).to.have.property('created');
			expect(meta.created).to.have.property('type', 'date');

			expect(meta).to.have.property('name');
			expect(meta.name).to.have.property('type', 'string');

			expect(meta).to.have.property('content');
			expect(meta.content).to.have.property('type', 'string');

			expect(meta).to.have.property('status');
			expect(meta.status).to.have.property('type', 'string');
			expect(meta.status).to.have.property('enum');
			expect(meta.status.enum).to.be.deep.equal(['active', 'deleted']);

			expect(meta).to.have.property('color');
			expect(meta.color).to.have.property('type', 'string');
			expect(meta.color).to.have.property('enum');
			expect(meta.color.enum).to.be.deep.equal(['red', 'green', 'blue', 'yellow']);

			finish();
		});
	});

	it('should get the meta information of the groups model', function(finish) {
		monoxide.meta({
			$collection: 'groups',
		}, function(err, meta) {
			expect(err).to.not.be.ok;
			expect(meta).to.be.an.object;

			expect(meta).to.have.property('name');
			expect(meta.name).to.have.property('type', 'string');

			expect(meta).to.have.property('users');
			expect(meta.users).to.have.property('type', 'array');

			expect(meta).to.have.property('preferences.defaults.items');
			expect(meta['preferences.defaults.items']).to.have.property('type', 'array');

			finish();
		});
	});

	it('should get the meta information of the users model (with collection enums)', function(finish) {
		monoxide.meta({
			$collection: 'users',
			$collectionEnums: true,
		}, function(err, meta) {
			expect(err).to.not.be.ok;
			expect(meta).to.be.an.object;

			expect(meta).to.have.property('role');
			expect(meta.role).to.have.property('type', 'string');
			expect(meta.role).to.have.property('default', 'user');
			expect(meta.role).to.have.property('enum');
			expect(meta.role.enum).to.be.deep.equal([
				{id: 'user', title: 'User'},
				{id: 'admin', title: 'Admin'},
			]);

			expect(meta).to.have.property('settings.lang');
			expect(meta['settings.lang']).to.have.property('type', 'string');
			expect(meta['settings.lang']).to.have.property('default', 'en');
			expect(meta['settings.lang']).to.have.property('enum');
			expect(meta['settings.lang'].enum).to.be.deep.equal([
				{id: 'en', title: 'En'},
				{id: 'es', title: 'Es'},
				{id: 'fr', title: 'Fr'},
				{id: 'elmerFudd', title: 'Elmer Fudd'},
			]);

			finish();
		});
	});

	it('should get the meta information of the users model (with prototype)', function(finish) {
		monoxide.meta({
			$collection: 'users',
			$prototype: true,
		}, function(err, meta) {
			expect(err).to.not.be.ok;
			expect(meta).to.be.an.object;

			expect(meta).to.have.property('$prototype');
			expect(meta.$prototype).to.be.an.object;
			expect(meta.$prototype).to.be.deep.equal({
				role: 'user',
				settings: {
					lang: 'en',
				},
			});

			finish();
		});
	});
});
