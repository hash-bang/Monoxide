var expect = require('chai').expect;
var mongoloid = require('..');
var testSetup = require('./setup');

describe('Mongoloid - query builder', function() {
	before(testSetup.init);

	it('should query the users model', function(finish) {
		mongoloid.model('users')
			.find()
			.sort('name')
			.populate('items')
			.populate('mostPurchased.item')
			.exec(function(err, users) {
				expect(err).to.not.be.ok;
				expect(users).to.be.an.array;

				expect(users[0]).to.have.property('name', 'Jane Quark');
				expect(users[0]).to.have.property('role', 'user');
				expect(users[0]).to.have.property('favourite');
				expect(users[0].favourite).to.be.a.string;
				expect(users[0]).to.have.property('mostPurchased');
				expect(users[0].mostPurchased).to.be.an.array;
				expect(users[0].mostPurchased).to.have.length(2);
				expect(users[0].mostPurchased[0]).to.have.property('number', 1);
				expect(users[0].mostPurchased[0].item).to.be.a.string;
				expect(users[0].mostPurchased[1]).to.have.property('number', 2);
				expect(users[0].mostPurchased[1].item).to.be.a.string;

				expect(users[1]).to.have.property('name', 'Joe Random');
				expect(users[1]).to.have.property('role', 'user');
				expect(users[1]).to.have.property('favourite');
				expect(users[1].mostPurchased).to.be.an.array;
				expect(users[1].mostPurchased).to.have.length(3);
				expect(users[1].mostPurchased[0]).to.have.property('number', 5);
				expect(users[1].mostPurchased[0].item).to.be.a.string;
				expect(users[1].mostPurchased[1]).to.have.property('number', 10);
				expect(users[1].mostPurchased[1].item).to.be.a.string;
				expect(users[1].mostPurchased[2]).to.have.property('number', 15);
				expect(users[1].mostPurchased[2].item).to.be.a.string;

				finish();
			});
	});
});
