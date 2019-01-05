var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.queryBuilder (promises)', function() {
	before(testSetup.init);
	before(done => monoxide.use('promises', done));
	after(testSetup.teardown);

	it('should query the users model as a promise (via promise())', function(finish) {
		monoxide.models.users
			.find()
			.promise()
			.then(user => {
				expect(user).to.be.an('array');
				expect(user).to.have.length(2);
				finish();
			})
			.catch(()=> expect.fail())
	});

	it('should query the users model as a promise (via then())', function(finish) {
		monoxide.models.users
			.find()
			.then(user => {
				expect(user).to.be.an('array');
				expect(user).to.have.length(2);
				finish();
			})
			.catch(()=> expect.fail())
	});

	it('should query the users model as a promise (via catch())', function(finish) {
		monoxide.models.users
			.find()
			.catch(()=> expect.fail())
			.then(user => {
				expect(user).to.be.an('array');
				expect(user).to.have.length(2);
				finish();
			})
	});

	it('should query the users model as a promise (via finally())', function(finish) {
		monoxide.models.users
			.find()
			.catch(()=> expect.fail())
			.then(user => {
				expect(user).to.be.an('array');
				expect(user).to.have.length(2);
				finish();
			})
	});

	it('should return results and process them as promises', function(finish) {
		monoxide.models.users
			.findOne()
			.then(user => {
				expect(user).to.be.an('object');
				expect(user).to.have.property('_id');
				var saver = user.save();
				expect(saver).to.be.a('promise');
				return saver;
			})
			.then(()=> finish())
			.catch(()=> expect.fail())
	});
});
