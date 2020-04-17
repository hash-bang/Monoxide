var _ = require('lodash');
var expect = require('chai').expect;
var mlog = require('mocha-logger');
var sinon = require('sinon');
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.use (logging)', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	var logs = [];
	before(function (finish) {
		monoxide.models.users.use(function(model, callback) {
			model.hook('postCreate', function(next, doc) {
				mlog.log('Create operation on', doc._id, 'with', _(doc)
					.map((v,k) => `${k}=${v}`)
					.join(', '));
				logs.push(doc);
				next();
			});
			finish();
		});
	});

	beforeEach(function () {
		logs = [];
	});

	it('should have registered a postCreate hook', function() {
		expect(monoxide.models.users.$hooks).to.have.property('postCreate').to.be.an('array');
	});

	it('should fire the logging function manually', function(finish) {
		monoxide.models.users.fire('postCreate', function(err) {
			expect(err).to.be.not.ok;
			expect(logs).to.have.length(1);
			expect(logs[0]).to.be.deep.equal({_id: 'manual'});
			finish();
		}, {_id: 'manual'});
	});

	it('should fire the logging function when creating a record', function(finish) {
		monoxide.create({
			$collection: 'users',
			name: 'New user with logging',
		}, function(err) {
			expect(err).to.be.not.ok;
			expect(logs).to.have.length(1);
			expect(logs[0]).to.have.property('name', 'New user with logging');
			finish();
		});
	});
});
