var async = require('async-chainable');
var bodyParser = require('body-parser');
var expect = require('chai').expect;
var express = require('express');
var expressLogger = require('express-log-url');
var mlog = require('mocha-logger');
var monoxide = require('..');
var superagent = require('superagent');
var testSetup = require('./setup');

var port = 8181;
var url = 'http://localhost:' + port;

describe('Monoxide + Express permissions', function() {
	before(testSetup.init);

	var widgets;
	it('should query all widgets normally', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.get('/api/widgets', monoxide.express.middleware('widgets', {
			get: true,
			query: true,
			count: true,
			save: false,
			delete: false,
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.get(url + '/api/widgets')
				.query({
					sort: 'name',
				})
				.end(function(err, res) {
					expect(err).to.be.not.ok;

					widgets = res.body;
					expect(widgets).to.be.an.array;
					expect(widgets).to.have.length(3);
					server.close();
					finish();
				});
		});
	});

	it('should be denied query by ID', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.get('/api/widgets', monoxide.express.middleware('widgets', {
			get: false,
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.get(url + '/api/widgets/' + widgets[0]._id)
				.end(function(err, res) {
					expect(err).to.be.ok;
					expect(res.body).to.be.empty;

					server.close();
					finish();
				});
		});
	});

	it('should be denied query', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.get('/api/widgets', monoxide.express.middleware('widgets', {
			query: false,
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.get(url + '/api/widgets')
				.end(function(err, res) {
					expect(err).to.be.ok;
					expect(res.body).to.be.empty;

					server.close();
					finish();
				});
		});
	});

	it('should be denied count', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.get('/api/widgets', monoxide.express.middleware('widgets', {
			count: false,
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.get(url + '/api/widgets/count')
				.end(function(err, res) {
					expect(err).to.be.ok;
					expect(res.body).to.be.empty;

					server.close();
					finish();
				});
		});
	});

	it('should be denied save', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.post('/api/widgets', monoxide.express.middleware('widgets', {
			save: false,
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.post(url + '/api/widgets/' + widgets[0]._id)
				.send({status: 'deleted'})
				.end(function(err, res) {
					expect(err).to.be.ok;
					expect(res.body).to.be.empty;

					server.close();
					finish();
				});
		});
	});

	it('should be denied delete', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.get('/api/widgets', monoxide.express.middleware('widgets', {
			delete: false,
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.delete(url + '/api/widgets/' + widgets[0]._id)
				.end(function(err, res) {
					expect(err).to.be.ok;
					expect(res.body).to.be.empty;

					server.close();
					finish();
				});
		});
	});
});
