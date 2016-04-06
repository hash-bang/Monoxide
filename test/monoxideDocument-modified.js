var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxideDocument.isModified()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	it('should detect when simple types change', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.array;

			var user = res[0];
			user.name += '!';

			var modified = user.isModified();
			expect(modified).to.be.ok;
			expect(modified).to.be.an.array;
			expect(modified).to.have.length(1);
			expect(modified[0]).to.be.equal('name');

			expect(user.isModified('name')).to.be.ok;

			finish();
		});
	});

	it('should detect when nested simple types change (object)', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.array;

			var user = res[0];
			user.settings.lang = 'fr';

			var modified = user.isModified();
			expect(modified).to.be.ok;
			expect(modified).to.be.an.array;
			expect(modified).to.have.length(1);
			expect(modified[0]).to.be.equal('settings.lang');

			expect(user.isModified('settings.lang')).to.be.true;

			finish();
		});
	});

	it('should detect when nested simple types change (array)', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.array;

			var user = res[0];
			user.mostPurchased[0].number = 99;

			var modified = user.isModified();
			expect(modified).to.be.ok;
			expect(modified).to.be.an.array;
			expect(modified).to.have.length(1);
			expect(modified[0]).to.be.equal('mostPurchased.0.number');

			expect(user.isModified('mostPurchased.0.number')).to.be.true;

			finish();
		});
	});

	it('should detect when array types change', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.array;

			var user = res[0];
			user.mostPurchased = [
				{number: 80},
				{number: 81},
				{number: 82},
			];

			var modified = user.isModified();
			expect(modified).to.be.ok;
			expect(modified).to.be.an.array;
			expect(modified).to.have.length(1);
			expect(modified[0]).to.be.equal('mostPurchased');

			expect(user.isModified('mostPurchased')).to.be.true;

			finish();
		});
	});

	it('should detect when object types change', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.array;

			var user = res[0];
			user.settings = {
				lang: 'fr',
				greeting: 'Bonjour',
			};

			var modified = user.isModified();
			expect(modified).to.be.ok;
			expect(modified).to.be.an.array;
			expect(modified).to.have.length(1);
			expect(modified[0]).to.be.equal('settings');

			expect(user.isModified('settings')).to.be.true;

			finish();
		});
	});
});
