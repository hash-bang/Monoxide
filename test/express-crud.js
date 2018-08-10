var bodyParser = require('body-parser');
var expect = require('chai').expect;
var express = require('express');
var expressLogger = require('express-log-url');
var mongoose = require('mongoose');
var monoxide = require('..');
var superagent = require('superagent');
var testSetup = require('./setup');

var port = 8181;
var url = 'http://localhost:' + port;

describe('monoxide.express - create, read, update, destroy', function() {
	before('load the rest plugin', done => monoxide.use('rest', done));
	before(testSetup.init);
	after(testSetup.teardown);
	after(() => { if (server) server.close() });

	// Setup {{{
	var widgets;
	it('should get a list of existing widgets', function(finish) {
		monoxide.query({
			$collection: 'widgets',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an('array');
			widgets = res;
			finish();
		});
	});

	var server;
	it('should setup a server', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');
		app.use('/api/users/:id?', monoxide.express.middleware('users', {
			create: true,
			get: true,
			query: true,
			count: true,
			save: true,
			delete: true,
		}));
		server = app.listen(port, null, finish);
	});
	// }}}

	// Create {{{
	var newUser;
	it('should create a new user', function(finish) {
		superagent.post(url + '/api/users')
			.send({
				name: 'Diziet Sma',
				favourite: widgets[0]._id,
				mostPurchased: [
					{number: 72, item: widgets[1]._id},
					{number: 89, item: widgets[2]._id},
				],
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				newUser = res.body;
				expect(newUser).to.be.an('object');

				expect(newUser).to.have.property('name', 'Diziet Sma');
				expect(newUser).to.have.property('role', 'user');
				expect(newUser).to.have.property('mostPurchased');
				expect(newUser.mostPurchased).to.be.an('array');
				expect(newUser.mostPurchased).to.have.length(2);
				expect(newUser.mostPurchased[0]).to.have.property('number', 72);
				expect(newUser.mostPurchased[0]).to.have.property('item', widgets[1]._id);
				expect(newUser.mostPurchased[1]).to.have.property('number', 89);
				expect(newUser.mostPurchased[1]).to.have.property('item', widgets[2]._id);
				expect(newUser.mostPurchased[1].item).to.be.a('string');

				finish();
			});
	});

	it('should have created the user (raw DB checks)', function(finish) {
		monoxide.models.users.$mongooseModel.findOne({name: 'Diziet Sma'}, function(err, doc) {
			expect(err).to.be.not.ok;

			expect(doc).to.have.property('favourite');
			expect(doc.favourite.toString()).to.be.equal(widgets[0]._id);
			expect(doc.favourite).to.be.an.instanceOf(mongoose.Types.ObjectId);

			expect(doc.mostPurchased).to.be.an('array');
			expect(doc.mostPurchased).to.have.length(2);

			expect(doc.mostPurchased[0]).to.have.property('number', 72);
			expect(doc.mostPurchased[0]).to.have.property('item');
			expect(doc.mostPurchased[0].item.toString()).to.be.equal(widgets[1]._id);
			expect(doc.mostPurchased[0].item).to.be.an.instanceOf(mongoose.Types.ObjectId);

			expect(doc.mostPurchased[1]).to.have.property('number', 89);
			expect(doc.mostPurchased[1]).to.have.property('item');
			expect(doc.mostPurchased[1].item.toString()).to.be.equal(widgets[2]._id);
			expect(doc.mostPurchased[1].item).to.be.an.instanceOf(mongoose.Types.ObjectId);


			finish();
		});
	});
	// }}}

	// Read (get + query) {{{
	it('should get the user by its ID', function(finish) {
		superagent.get(url + '/api/users/' + newUser._id)
			.end(function(err, res) {
				expect(err).to.be.not.ok;
				expect(res.body).to.be.an('object');
				expect(res.body).to.have.property('_id', newUser._id);
				finish();
			});
	});

	it('should find the user by a query', function(finish) {
		superagent.get(url + '/api/users')
			.query({name: 'Diziet Sma'})
			.end(function(err, res) {
				expect(err).to.be.not.ok;
				expect(res.body).to.be.an('array');
				expect(res.body).to.have.length(1);
				expect(res.body[0]).to.have.property('_id', newUser._id);
				finish();
			});
	});
	// }}}

	// Update {{{
	it('should update the user', function(finish) {
		superagent.post(url + '/api/users/' + newUser._id)
			.send({
				name: 'Cheradenine Zakalwe',
				favourite: widgets[2]._id,
				mostPurchased: [
					{number: 5, item: widgets[0]._id},
				],
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;
				expect(res.body).to.be.an('object');
				expect(res.body).to.have.property('_id', newUser._id);
				expect(res.body).to.have.property('name', 'Cheradenine Zakalwe');
				expect(res.body).to.have.property('favourite', widgets[2]._id);
				expect(res.body).to.have.property('mostPurchased');
				expect(res.body.mostPurchased).to.be.an('array');
				expect(res.body.mostPurchased).to.have.length(1);
				expect(res.body.mostPurchased[0]).to.have.property('number', 5);
				expect(res.body.mostPurchased[0]).to.have.property('item', widgets[0]._id);

				finish();
			});
	});

	it('should have updated the user (raw DB checks)', function(finish) {
		monoxide.models.users.$mongooseModel.findOne({name: 'Cheradenine Zakalwe'}, function(err, doc) {
			expect(err).to.be.not.ok;

			expect(doc).to.have.property('favourite');
			expect(doc.favourite.toString()).to.be.equal(widgets[2]._id);
			expect(doc.favourite).to.be.an.instanceOf(mongoose.Types.ObjectId);

			expect(doc.mostPurchased).to.be.an('array');
			expect(doc.mostPurchased).to.have.length(1);

			expect(doc.mostPurchased[0]).to.have.property('number', 5);
			expect(doc.mostPurchased[0]).to.have.property('item');
			expect(doc.mostPurchased[0].item.toString()).to.be.equal(widgets[0]._id);
			expect(doc.mostPurchased[0].item).to.be.an.instanceOf(mongoose.Types.ObjectId);

			finish();
		});
	});
	// }}}

	// Delete {{{
	it('should delete the user', function(finish) {
		superagent.delete(url + '/api/users/' + newUser._id)
			.end(function(err, res) {
				expect(err).to.be.not.ok;
				finish();
			});
	});

	it('should have deleted the user (raw DB checks)', function(finish) {
		monoxide.models.users.$mongooseModel.findOne({name: 'Cheradenine Zakalwe'}, function(err, doc) {
			expect(err).to.be.not.ok;
			expect(doc).to.be.not.ok;

			finish();
		});
	});
	// }}}

});
