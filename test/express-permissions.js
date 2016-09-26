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

describe('monoxide.express (permission tests)', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	var widgets;
	it('should query all widgets normally', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		// Setup hooks to check that $data exists {{{
		monoxide.models.widgets
			.hook('query', function(next, q) {
				if (!q.$data) return next();
				expect(q).to.have.property('$data');
				expect(q.$data).to.have.property('quz', 'qux');
				expect(q.$data).to.have.property('corge', 456);
				next();
			})
			.hook('save', function(next, doc) {
				expect(doc).to.have.property('$data');
				expect(doc.$data).to.have.property('quz', 'qux');
				expect(doc.$data).to.have.property('corge', 456);
				next();
			})
			.hook('postSave', function(next, doc) {
				expect(doc).to.have.property('$data');
				expect(doc.$data).to.have.property('quz', 'qux');
				expect(doc.$data).to.have.property('corge', 456);
				next();
			})
		// }}}

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
			get: true,
			query: true,
			count: true,
			save: false,
			delete: false,
			$data: function(next, doc) {
				return next(null, { // Junk data to attach to $data in the downstream DB calls
					quz: 'qux',
					corge: 456,
				});
			},
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
					server.close(finish);
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

					server.close(finish);
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
			$data: function(next, doc) {
				return next(null, { // Junk data to attach to $data in the downstream DB calls
					quz: 'qux',
					corge: 456,
				});
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

							server.close(finish);
						});
				});
		});
	});

	it('should be denied query by ID selectively (get=array of functions)', function(finish) {
		var app = express();
		var calledMiddleware = [];
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
			get: [
				function(req, res, next) {
					calledMiddleware.push('m1');
					if (req.query.foo == 'foo!') return next();

					// Handle error ourselves
					res.status(404).send('Hidden page!').end();
				},

				function(req, res, next) {
					calledMiddleware.push('m2');
					if (req.query.bar == 'bar!') return next();

					// Use middleware to handle error
					next('Access denied');
				},

				function(req, res, next) {
					calledMiddleware.push('m3');
					if (req.query.baz == 'baz!') return next();

					// Throw another error
					res.status(500).send('Fake server error').end();
				},
			],
			$data: function(next, doc) {
				return next(null, { // Junk data to attach to $data in the downstream DB calls
					quz: 'qux',
					corge: 456,
				});
			},
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			// Should throw 404
			calledMiddleware = [];
			superagent.get(url + '/api/widgets/' + widgets[0]._id).end(function(err, res) {
				expect(calledMiddleware).to.deep.equal(['m1']);
				expect(err).to.be.ok;
				expect(res.statusCode).to.be.equal(404);

				// Should throw 403
				calledMiddleware = [];
				superagent.get(url + '/api/widgets/' + widgets[0]._id + '?foo=foo!').end(function(err, res) {
					expect(calledMiddleware).to.deep.equal(['m1','m2']);
					expect(err).to.be.ok;
					expect(res.statusCode).to.be.equal(403);

					// Should throw 500
					calledMiddleware = [];
					superagent.get(url + '/api/widgets/' + widgets[0]._id + '?foo=foo!&bar=bar!').end(function(err, res) {
						expect(calledMiddleware).to.deep.equal(['m1','m2','m3']);
						expect(err).to.be.ok;
						expect(res.statusCode).to.be.equal(500);

						// Should be ok
						calledMiddleware = [];
						superagent.get(url + '/api/widgets/' + widgets[1]._id + '?foo=foo!&bar=bar!&baz=baz!').end(function(err, res) {
							expect(calledMiddleware).to.deep.equal(['m1','m2','m3']);
							expect(err).to.be.not.ok;
							expect(res.statusCode).to.be.equal(200);
							expect(res.body).to.be.an.object;
							expect(res.body).to.have.property('_id');

							server.close(finish);
						});
					});
				});
			});
		});
	});

	it('should be denied query by ID selectively (get=string pointer)', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
			get: 'query',
			query: [
				function(req, res, next) {
					if (req.query.foo != 'foo!') return next('foo query must be specified');
					next();
				},
			],
			$data: function(next, doc) {
				return next(null, { // Junk data to attach to $data in the downstream DB calls
					quz: 'qux',
					corge: 456,
				});
			},
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			// Should throw 403
			calledMiddleware = [];
			superagent.get(url + '/api/widgets/' + widgets[0]._id).end(function(err, res) {
				expect(err).to.be.ok;
				expect(res.statusCode).to.be.equal(403);

				// Should be ok
				calledMiddleware = [];
				superagent.get(url + '/api/widgets/' + widgets[1]._id + '?foo=foo!').end(function(err, res) {
					expect(err).to.be.not.ok;
					expect(res.statusCode).to.be.equal(200);
					expect(res.body).to.be.an.object;
					expect(res.body).to.have.property('_id');

					server.close(finish);
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

					server.close(finish);
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
			$data: function(next, doc) {
				return next(null, { // Junk data to attach to $data in the downstream DB calls
					quz: 'qux',
					corge: 456,
				});
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

							server.close(finish);
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
			$data: function(next, doc) {
				return next(null, { // Junk data to attach to $data in the downstream DB calls
					quz: 'qux',
					corge: 456,
				});
			},
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.get(url + '/api/widgets/count')
				.end(function(err, res) {
					expect(err).to.be.ok;
					expect(res.body).to.be.empty;

					server.close(finish);
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
			$data: function(next, doc) {
				return next(null, { // Junk data to attach to $data in the downstream DB calls
					quz: 'qux',
					corge: 456,
				});
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

							server.close(finish);
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

					server.close(finish);
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
			$data: function(next, doc) {
				return next(null, { // Junk data to attach to $data in the downstream DB calls
					quz: 'qux',
					corge: 456,
				});
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

							server.close(finish);
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

					server.close(finish);
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
			$data: function(next, doc) {
				return next(null, { // Junk data to attach to $data in the downstream DB calls
					quz: 'qux',
					corge: 456,
				});
			},
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			superagent.delete(url + '/api/widgets/' + widgets[0]._id)
				.end(function(err, res) {
					expect(err).to.be.ok;
					expect(res.statusCode).to.be.equal(403);
					expect(res.body).to.be.empty;

					superagent.delete(url + '/api/widgets/' + widgets[0]._id)
						.query({force: 'confirm'})
						.end(function(err, res) {
							expect(err).to.be.not.ok;
							expect(res.statusCode).to.be.equal(200);
							widgets.shift(); // Remove first item so future tests dont access the deleted widget

							server.close(finish);
						});
				});
		});
	});

	it('should remap delete to update operation (default delete=function)', function(finish) {
		var app = express();
		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');
		monoxide.express.defaults({
			delete: function(req, res, next) {
				monoxide.save({
					$collection: req.monoxide.collection,
					$id: req.monoxide.id,
					$data: { // Set the data also so that the hooks don't complain
						quz: 'qux',
						corge: 456,
					},
					status: 'deleted',
				}, function(err) {
					if (err) return res.status(400).send(err).end();
					res.send({});
				});
			},
		});

		app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
		}));

		var server = app.listen(port, null, function(err) {
			if (err) return finish(err);

			// Perform delete (which should remap to update)
			superagent.delete(url + '/api/widgets/' + widgets[0]._id)
				.end(function(err, res) {
					expect(err).to.be.not.ok;

					// Re-get the record and check status==deleted
					superagent.get(url + '/api/widgets/' + widgets[0]._id)
						.end(function(err, res) {
							expect(err).to.be.not.ok;
							expect(res.body).to.be.an.object;
							expect(res.body).to.have.property('_id', widgets[0]._id);
							expect(res.body).to.have.property('status', 'deleted');

							server.close(finish);
						});
				});
		});
	});
});
