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

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
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

	it('should be denied query by ID (get=false)', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
			get: false,
			query: false,
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

	it('should be denied query by ID selectively (get=function)', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
			get: function(req, res, next) {
				if (req.params.id == widgets[0]._id) return res.status(403).send('Nope!').end();
				next();
			},
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.get(url + '/api/widgets/' + widgets[0]._id)
				.end(function(err, res) {
					expect(err).to.be.ok;
					expect(res.body).to.be.empty;

					superagent.get(url + '/api/widgets/' + widgets[1]._id)
						.end(function(err, res) {
							expect(err).to.be.not.ok;
							expect(res.body).to.be.an.object;
							expect(res.body).to.have.property('_id');

							server.close();
							finish();
						});
				});
		});
	});

	it('should be denied query (query=false)', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
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

	it('should be denied query by ID selectively (query=function)', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
			query: function(req, res, next) {
				// Only allow querying if ?foobar=baz in the query
				if (req.query.foobar && req.query.foobar == 'baz') {
					delete req.query.foobar; // Delete from query so we dont filter records by this
					return next();
				}
				return res.status(403).send('Nope!').end();
			},
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.get(url + '/api/widgets?color=blue')
				.end(function(err, res) {
					expect(err).to.be.ok;
					expect(res.body).to.be.empty;

					superagent.get(url + '/api/widgets?foobar=baz&color=blue')
						.end(function(err, res) {
							expect(err).to.be.not.ok;
							expect(res.body).to.be.an.array;
							expect(res.body).to.have.length(2);

							server.close();
							finish();
						});
				});
		});
	});

	it('should be denied count (count=false)', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
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

	it('should be denied count selectively (count=function)', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
			count: function(req, res, next) {
				// Only allow count if ?color=blue
				if (req.query.color && req.query.color == 'blue') return next();
				return res.status(403).send('Nope!').end();
			},
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.get(url + '/api/widgets/count?color=red')
				.end(function(err, res) {
					expect(err).to.be.ok;
					expect(res.body).to.be.empty;

					superagent.get(url + '/api/widgets/count?color=blue')
						.end(function(err, res) {
							expect(err).to.be.not.ok;
							expect(res.body).to.be.an.object;
							expect(res.body).to.have.property('count', 2);

							server.close();
							finish();
						});
				});
		});
	});

	it('should be denied save (save=false)', function(finish) {
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

	it('should be denied save selectively (save=function)', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
			save: function(req, res, next) {
				// Only allow saving if the body contains 'force' as a true boolean variable
				if (req.body.force && req.body.force === true) return next();
				return res.status(403).send('Nope!').end();
			},
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.post(url + '/api/widgets/' + widgets[0]._id)
				.send({color: 'yellow'})
				.end(function(err, res) {
					expect(err).to.be.ok;
					expect(res.body).to.be.empty;

					superagent.post(url + '/api/widgets/' + widgets[0]._id)
						.send({color: 'yellow', force: true})
						.end(function(err, res) {
							expect(err).to.be.not.ok;
							expect(res.body).to.be.an.object;
							expect(res.body).to.have.property('_id', widgets[0]._id);
							expect(res.body).to.have.property('color', 'yellow');

							server.close();
							finish();
						});
				});
		});
	});

	it('should be denied delete (delete=false)', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
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

	it('should be denied delete selectively (delete=function)', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
			delete: function(req, res, next) {
				// Only allow delete if the query contains 'force' as a string
				if (req.query.force && req.query.force === 'confirm') return next();
				return res.status(403).send('Nope!').end();
			},
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.delete(url + '/api/widgets/' + widgets[0]._id)
				.end(function(err, res) {
					expect(err).to.be.ok;
					expect(res.body).to.be.empty;

					superagent.delete(url + '/api/widgets/' + widgets[0]._id)
						.query({force: 'confirm'})
						.end(function(err, res) {
							expect(err).to.be.not.ok;

							server.close();
							finish();
						});
				});
		});
	});
});
