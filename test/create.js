var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('Monoxide - create', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	it('create save new user', function(finish) {
		monoxide.create({
			$collection: 'users',
			name: 'New User',
			mostPurchased: [
				{number: 50},
				{number: 60},
			],
			password: 'wonderful',
		}, function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.object;

			expect(user).to.have.property('name', 'New User');
			expect(user).to.have.property('role', 'user');
			expect(user).to.have.property('_password', 'oeu');
			expect(user).to.have.property('favourite');
			expect(user.favourite).to.be.a.string;
			expect(user).to.have.property('mostPurchased');
			expect(user.mostPurchased).to.be.an.array;
			expect(user.mostPurchased).to.have.length(2);
			expect(user.mostPurchased[0]).to.have.property('number', 50);
			expect(user.mostPurchased[0].item).to.be.undefined;
			expect(user.mostPurchased[1]).to.have.property('number', 60);
			expect(user.mostPurchased[1].item).to.be.undefined;

			finish();
		});
	});

	it('create save new user (monoxide.model method)', function(finish) {
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
});
