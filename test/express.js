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

describe('Mongoloid + Express - query', function() {
	before(testSetup.init);

	before(function(finish) {
		app.use(expressLogger);
		app.get('/api/users', mongoloid.restGet('users'));
		server = app.listen(port, null, function(err) {
			if (err) return finish(err);
			mlog.log('Server listening on http://localhost:' + port);
			finish();
		});
	});

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
});
