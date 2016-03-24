var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('Monoxide - save', function() {
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

	it('should save a user', function(finish) {
		monoxide.save({
			$collection: 'users',
			$id: users[0]._id,
			name: 'Edited User',
			mostPurchased: [
				{number: 12},
				{number: 15},
			],
		}, function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.object;

			expect(user).to.have.property('name', 'Edited User');
			expect(user).to.have.property('role', 'user');
			expect(user).to.have.property('favourite');
			expect(user.favourite).to.be.a.string;
			expect(user).to.have.property('mostPurchased');
			expect(user.mostPurchased).to.be.an.array;
			expect(user.mostPurchased).to.have.length(2);
			expect(user.mostPurchased[0]).to.have.property('number', 12);
			expect(user.mostPurchased[0].item).to.be.undefined;
			expect(user.mostPurchased[1]).to.have.property('number', 15);
			expect(user.mostPurchased[1].item).to.be.undefined;

			finish();
		});
	});

	it('should save a user (via model)', function(finish) {
		users[0].name = 'Edited User2';
		users[0].mostPurchased = [
			{number: 12},
			{number: 15},
		];
		users[0].save(function(err, user) {
			expect(err).to.not.be.ok;
			expect(user).to.be.an.object;

			expect(user).to.have.property('name', 'Edited User2');
			expect(user).to.have.property('role', 'user');
			expect(user).to.have.property('favourite');
			expect(user.favourite).to.be.a.string;
			expect(user).to.have.property('mostPurchased');
			expect(user.mostPurchased).to.be.an.array;
			expect(user.mostPurchased).to.have.length(2);
			expect(user.mostPurchased[0]).to.have.property('number', 12);
			expect(user.mostPurchased[0].item).to.be.undefined;
			expect(user.mostPurchased[1]).to.have.property('number', 15);
			expect(user.mostPurchased[1].item).to.be.undefined;

			finish();
		});
	});
});
