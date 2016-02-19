var async = require('async-chainable');
var bodyParser = require('body-parser');
var expect = require('chai').expect;
var express = require('express');
var expressLogger = require('express-log-url');
var mlog = require('mocha-logger');
var mongoloid = require('..');
var superagent = require('superagent');
var testSetup = require('./setup');

var app = express();
var server;

var port = 8181;

describe('Mongoloid + Express', function() {
	before(testSetup.init);

	before(function(finish) {
		app.use(expressLogger);
		app.use(bodyParser.json());

		app.get('/api/users', mongoloid.express.get('users'));
		app.get('/api/users/:id', mongoloid.express.get('users'));
		app.post('/api/users', mongoloid.express.save('users'));
		app.post('/api/users/:id', mongoloid.express.save('users'));

		app.get('/api/widgets', mongoloid.express.get('widgets'));
		app.get('/api/widgets/:id', mongoloid.express.get('widgets'));
		app.post('/api/widgets', mongoloid.express.save('widgets'));
		app.post('/api/widgets/:id', mongoloid.express.save('widgets'));
		app.delete('/api/widgets/:id', mongoloid.express.delete('widgets'));

		server = app.listen(port, null, function(err) {
			if (err) return finish(err);
			mlog.log('Server listening on http://localhost:' + port);
			finish();
		});
	});

	// GET {{{
	it('should query users via ReST', function(finish) {
		superagent.get('http://localhost:' + port + '/api/users')
			.query({
				sort: 'name',
				populate: 'favourite',
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var users = res.body;
				expect(users).to.be.an.array;

				expect(users[0]).to.have.property('name', 'Jane Quark');
				expect(users[0]).to.have.property('role', 'user');
				expect(users[0]).to.have.property('favourite');
				expect(users[0].favourite).to.be.an.object;
				expect(users[0].favourite).to.have.property('name', 'Widget bang');
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
	// }}}

	// POST - create {{{
	it('should create users via ReST', function(finish) {
		superagent.post('http://localhost:' + port + '/api/users')
			.send({
				name: 'New User via ReST',
				mostPurchased: [
					{number: 80},
					{number: 90},
				],
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var user = res.body;
				expect(user).to.be.an.object;

				expect(user).to.have.property('name', 'New User via ReST');
				expect(user).to.have.property('role', 'user');
				expect(user).to.have.property('mostPurchased');
				expect(user.mostPurchased).to.be.an.array;
				expect(user.mostPurchased).to.have.length(2);
				expect(user.mostPurchased[0]).to.have.property('number', 80);
				expect(user.mostPurchased[0].item).to.be.a.string;
				expect(user.mostPurchased[1]).to.have.property('number', 90);
				expect(user.mostPurchased[1].item).to.be.a.string;

				finish();
			});
	});

	it('should create widgets via ReST', function(finish) {
		superagent.post('http://localhost:' + port + '/api/widgets')
			.send({
				name: 'New Widget',
				content: 'This is a new widget, there are many like it but this one is my own',
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var widget = res.body;
				expect(widget).to.be.an.object;

				expect(widget).to.have.property('name', 'New Widget');
				expect(widget).to.have.property('content', 'This is a new widget, there are many like it but this one is my own');
				expect(widget).to.have.property('status', 'active');

				finish();
			});
	});
	// }}}

	// POST - update {{{
	it('should save over an existing record via ReST', function(finish) {
		async()
			.then('widget', function(next) {
				superagent.get('http://localhost:' + port + '/api/widgets')
					.query({
						name: 'New Widget',
					})
					.end(function(err, res) {
						if (err) return next(err);
						expect(err).to.be.not.ok;
						expect(res).to.be.an.array;

						next(null, res.body[0]);
					});
			})
			.then(function(next) {
				superagent.post('http://localhost:' + port + '/api/widgets/' + this.widget._id)
					.send({
						status: 'deleted',
					})
					.end(function(err, res) {
						expect(err).to.be.not.ok;

						var widget = res.body;
						expect(widget).to.be.an.object;

						expect(widget).to.have.property('name', 'New Widget');
						expect(widget).to.have.property('status', 'deleted');

						finish();
					});
			})
			.end(finish);
	});
	// }}}

	// DELETE {{{
	it('should delete an existing record via ReST', function(finish) {
		async()
			.then('widget', function(next) {
				superagent.get('http://localhost:' + port + '/api/widgets')
					.query({
						name: 'New Widget',
						status: 'deleted',
					})
					.end(function(err, res) {
						if (err) return next(err);
						expect(err).to.be.not.ok;
						expect(res).to.be.an.array;

						next(null, res.body[0]);
					});
			})
			.then(function(next) {
				superagent.delete('http://localhost:' + port + '/api/widgets/' + this.widget._id)
					.end(function(err, res) {
						expect(err).to.be.not.ok;

						finish();
					});
			})
			.end(finish);
	});

	it('should have removed the record from the db', function(finish) {
		superagent.get('http://localhost:' + port + '/api/widgets')
			.query({
				name: 'New Widget',
			})
			.end(function(err, res) {
				if (err) return next(err);
				expect(err).to.be.not.ok;
				expect(res.body).to.be.an.array;
				expect(res.body).to.have.length(0);

				finish();
			});
	});
	// }}}

});
