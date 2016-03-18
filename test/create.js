var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('Monoxide - create', function() {
	before(testSetup.init);

	it('create save new user', function(finish) {
		monoxide.create({
			$collection: 'users',
			name: 'New User',
			mostPurchased: [
				{number: 50},
				{number: 60},
			],
		}, function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.object;

			expect(user).to.have.property('name', 'New User');
			expect(user).to.have.property('role', 'user');
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
});
