var async = require('async-chainable');
var bodyParser = require('body-parser');
var expect = require('chai').expect;
var express = require('express');
var expressLogger = require('express-log-url');
var mlog = require('mocha-logger');
var monoxide = require('..');
var superagent = require('superagent');
var testSetup = require('./setup');

var app = express();
var server;

var port = 8181;
var url = 'http://localhost:' + port;

describe('monoxide.express.*', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	// Express Setup {{{
	before(function(finish) {
		this.timeout(10 * 1000);

		app.use(expressLogger);
		app.use(bodyParser.json());
		app.set('log.indent', '      ');

		app.get('/api/users', monoxide.express.query('users', {
			map: function(user) {
				user.nameParts = user.splitNames();
				return user;
			},
		}));
		app.get('/api/users/:id', monoxide.express.get('users', {
			map: function(user) {
				user.nameParts = user.splitNames();
				return user;
			},
		}));
		app.post('/api/users', monoxide.express.create('users'));
		app.post('/api/users/:id', monoxide.express.save('users'));

		app.get('/api/widgets', monoxide.express.query('widgets'));
		app.get('/api/widgets/count', monoxide.express.count('widgets'));
		app.get('/api/widgets/meta', monoxide.express.meta('widgets'));
		app.get('/api/widgets/:id', monoxide.express.get('widgets'));
		app.post('/api/widgets', monoxide.express.create('widgets'));
		app.post('/api/widgets/:id', monoxide.express.save('widgets'));
		app.delete('/api/widgets/:id', monoxide.express.delete('widgets'));

		app.use('/api/groups/:id?', monoxide.express.middleware('groups', {
			meta: true, // Have to enable this as its off by default
		}));

		server = app.listen(port, null, function(err) {
			if (err) return finish(err);
			mlog.log('Server listening on ' + url);
			finish();
		});
	});

	after(function(finish) {
		server.close(finish);
	});
	// }}}

	// GET (query) {{{
	var users;
	it('should query users via ReST', function(finish) {
		superagent.get(url + '/api/users')
			.query({
				sort: 'name',
				populate: 'favourite',
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				users = res.body;
				expect(users).to.be.an('array');

				expect(users[0]).to.have.property('__v'); // All fields prefixed with '_' should be omitted by default, excepting _id, __v
				expect(users[0]).to.have.property('name', 'Jane Quark');
				expect(users[0]).to.have.property('role', 'user');
				expect(users[0]).to.not.have.property('_password');
				expect(users[0]).to.have.property('favourite');
				expect(users[0].favourite).to.be.an('object');
				expect(users[0].favourite).to.have.property('name', 'Widget bang');
				expect(users[0]).to.have.property('mostPurchased');
				expect(users[0].mostPurchased).to.be.an('array');
				expect(users[0].mostPurchased).to.have.length(2);
				expect(users[0].mostPurchased[0]).to.have.property('number', 1);
				expect(users[0].mostPurchased[0].item).to.be.a('string');
				expect(users[0].mostPurchased[1]).to.have.property('number', 2);
				expect(users[0].mostPurchased[1].item).to.be.a('string');
				expect(users[0]).to.have.property('nameParts'); // Check that the map function fired
				expect(users[0].nameParts).to.deep.equal(['Jane', 'Quark']);

				expect(users[1]).to.have.property('name', 'Joe Random');
				expect(users[1]).to.have.property('role', 'user');
				expect(users[1]).to.have.property('favourite');
				expect(users[1].mostPurchased).to.be.an('array');
				expect(users[1].mostPurchased).to.have.length(3);
				expect(users[1].mostPurchased[0]).to.have.property('number', 5);
				expect(users[1].mostPurchased[0].item).to.be.a('string');
				expect(users[1].mostPurchased[1]).to.have.property('number', 10);
				expect(users[1].mostPurchased[1].item).to.be.a('string');
				expect(users[1].mostPurchased[2]).to.have.property('number', 15);
				expect(users[1].mostPurchased[2].item).to.be.a('string');
				expect(users[1]).to.have.property('nameParts');
				expect(users[1].nameParts).to.deep.equal(['Joe', 'Random']);

				finish();
			});
	});

	var widgets;
	it('should query widgets via ReST', function(finish) {
		superagent.get(url + '/api/widgets')
			.query({
				sort: 'name',
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				widgets = res.body;
				expect(widgets).to.be.an('array');
				expect(widgets).to.have.length(3);

				expect(widgets[0]).to.have.property('name', 'Widget bang');
				expect(widgets[1]).to.have.property('name', 'Widget crash');
				expect(widgets[2]).to.have.property('name', 'Widget whollop');

				finish();
			});
	});

	it('should query widgets via ReST (w/ boolean true)', function(finish) {
		superagent.get(url + '/api/widgets')
			.query({
				select: 'name',
				featured: true,
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				widgets = res.body;
				expect(widgets).to.be.an('array');
				expect(widgets).to.have.length(1);

				expect(widgets[0]).to.have.property('name', 'Widget crash');

				finish();
			});
	});

	it('should query widgets via ReST (w/ boolean false)', function(finish) {
		superagent.get(url + '/api/widgets')
			.query({
				select: 'name',
				featured: false,
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				widgets = res.body;
				expect(widgets).to.be.an('array');
				expect(widgets).to.have.length(2);

				expect(widgets[0]).to.have.property('name', 'Widget bang');
				expect(widgets[1]).to.have.property('name', 'Widget whollop');

				finish();
			});
	});

	it('should query widgets via ReST (array OR notation)', function(finish) {
		superagent.get(url + '/api/widgets')
			.query({
				color: ['red', 'blue'], // This should be remapped to {$in: ARRAY} automatically
				sort: '-name',
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var widgets = res.body;
				expect(widgets).to.be.an('array');
				expect(widgets).to.have.length(3);

				expect(widgets[0]).to.have.property('name', 'Widget whollop');
				expect(widgets[1]).to.have.property('name', 'Widget crash');
				expect(widgets[2]).to.have.property('name', 'Widget bang');

				finish();
			});
	});

	it('should query widgets via ReST ($nin + array notation)', function(finish) {
		superagent.get(url + '/api/widgets')
			.query({
				select: '_id,color',
				color: {$nin: ['red', 'pink']},
				sort: 'color',
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var widgets = res.body;
				expect(widgets).to.be.an('array');
				expect(widgets).to.have.length(2);

				expect(widgets[0]).to.have.property('color', 'blue');
				expect(widgets[1]).to.have.property('color', 'blue');

				finish();
			});
	});

	it('should query groups via ReST', function(finish) {
		superagent.get(url + '/api/groups')
			.query({
				sort: 'name',
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var widgets = res.body;
				expect(widgets).to.be.an('array');
				expect(widgets).to.have.length(3);

				expect(widgets[0]).to.have.property('name', 'Group Bar');
				expect(widgets[1]).to.have.property('name', 'Group Baz');
				expect(widgets[2]).to.have.property('name', 'Group Foo');

				finish();
			});
	});

	it('should query users via ReST (query an array)', function(finish) {
		superagent.get(url + '/api/users')
			.query({
				items: widgets[0]._id,
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var users = res.body;
				expect(users).to.be.an('array');
				expect(users).to.have.length(1);

				expect(users[0].items).to.be.deep.equal([widgets[0]._id]);

				finish();
			});
	});
	// }}}

	// GET (single ID) {{{
	it('should retrieve users by ID via ReST', function(finish) {
		superagent.get(url + '/api/users/' + users[0]._id)
			.query({
				populate: 'favourite',
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var user = res.body;
				expect(user).to.be.an('object');

				expect(user).to.have.property('__v'); // All fields prefixed with '_' should be omitted by default, excepting _id, __v
				expect(user).to.have.property('name', 'Jane Quark');
				expect(user).to.have.property('role', 'user');
				expect(user).to.not.have.property('_password');
				expect(user).to.have.property('favourite');
				expect(user.favourite).to.be.an('object');
				expect(user.favourite).to.have.property('name', 'Widget bang');
				expect(user).to.have.property('mostPurchased');
				expect(user.mostPurchased).to.be.an('array');
				expect(user.mostPurchased).to.have.length(2);
				expect(user.mostPurchased[0]).to.have.property('number', 1);
				expect(user.mostPurchased[0].item).to.be.a('string');
				expect(user.mostPurchased[1]).to.have.property('number', 2);
				expect(user.mostPurchased[1].item).to.be.a('string');

				expect(user).to.have.property('nameParts'); // Check that the map function fired
				expect(user.nameParts).to.deep.equal(['Jane', 'Quark']);

				finish();
			});
	});

	it('should retrieve a single user by ID (filtering by selected fields)', function(finish) {
		superagent.get(url + '/api/users/' + users[0]._id)
			.query({
				select: ['_id', 'name'],
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var user = res.body;
				expect(user).to.be.an('object');
				expect(user).to.be.deep.equal({
					_id: users[0]._id,
					name: users[0].name,
					nameParts: users[0].nameParts, // Custom fields will always be glued on
				});
				finish();
			});
	});

	it('should query widgets via ReST', function(finish) {
		superagent.get(url + '/api/widgets')
			.query({
				sort: 'name',
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var widgets = res.body;
				expect(widgets).to.be.an('array');
				expect(widgets).to.have.length(3);

				expect(widgets[0]).to.have.property('name', 'Widget bang');
				expect(widgets[1]).to.have.property('name', 'Widget crash');
				expect(widgets[2]).to.have.property('name', 'Widget whollop');

				finish();
			});
	});

	it('should query groups via ReST', function(finish) {
		superagent.get(url + '/api/groups')
			.query({
				sort: 'name',
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var widgets = res.body;
				expect(widgets).to.be.an('array');
				expect(widgets).to.have.length(3);

				expect(widgets[0]).to.have.property('name', 'Group Bar');
				expect(widgets[1]).to.have.property('name', 'Group Baz');
				expect(widgets[2]).to.have.property('name', 'Group Foo');

				finish();
			});
	});
	// }}}

	// GET (count) {{{
	it('should not be allowed to count users via ReST', function(finish) {
		superagent.get(url + '/api/users/count')
			.end(function(err, res) {
				expect(err).to.be.ok;

				expect(res.body).to.be.an('object');

				finish();
			});
	});

	it('should count widgets via ReST', function(finish) {
		superagent.get(url + '/api/widgets/count')
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				expect(res.body).to.be.an('object');
				expect(res.body).to.have.property('count');
				expect(res.body.count).to.be.equal(3);

				finish();
			});
	});

	it('should count groups via ReST', function(finish) {
		superagent.get(url + '/api/groups/count')
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				expect(res.body).to.be.an('object');
				expect(res.body).to.have.property('count');
				expect(res.body.count).to.be.equal(3);

				finish();
			});
	});
	// }}}

	// GET (meta) {{{
	it('should not be allowed to get meta information on users via ReST', function(finish) {
		superagent.get(url + '/api/users/meta')
			.end(function(err, res) {
				expect(err).to.be.ok;

				expect(res.body).to.be.an('object');

				finish();
			});
	});

	it('should get meta information on widgets via ReST', function(finish) {
		superagent.get(url + '/api/widgets/meta')
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				expect(res.body).to.be.an('object');
				expect(res.body).to.have.property('_id');
				expect(res.body._id).to.have.property('type', 'objectid');

				expect(res.body).to.have.property('name');
				expect(res.body.name).to.have.property('type', 'string');

				expect(res.body).to.have.property('content');
				expect(res.body.content).to.have.property('type', 'string');

				expect(res.body).to.have.property('status');
				expect(res.body.status).to.have.property('type', 'string');
				expect(res.body.status).to.have.property('default', 'active');
				expect(res.body.status).to.have.property('enum');
				expect(res.body.status.enum).to.be.deep.equal(['active', 'deleted']);

				expect(res.body).to.have.property('color');
				expect(res.body.color).to.have.property('default', 'blue');
				expect(res.body.color).to.have.property('type', 'string');
				expect(res.body.color).to.have.property('enum');
				expect(res.body.color.enum).to.be.deep.equal(['red', 'green', 'blue', 'yellow']);

				finish();
			});
	});

	it('should get meta information on groups via ReST', function(finish) {
		superagent.get(url + '/api/groups/meta')
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				expect(res.body).to.be.an('object');
				expect(res.body).to.have.property('_id');
				expect(res.body._id).to.have.property('type', 'objectid');

				finish();
			});
	});

	it('should get meta information on widgets via ReST (?collectionEnums=true)', function(finish) {
		superagent.get(url + '/api/widgets/meta?collectionEnums=true')
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				expect(res.body).to.be.an('object');

				expect(res.body).to.have.property('status');
				expect(res.body.status).to.have.property('enum');
				expect(res.body.status.enum).to.be.deep.equal([{id: 'active', title: 'Active'}, {id: 'deleted', title: 'Deleted'}]);

				expect(res.body).to.have.property('color');
				expect(res.body.color).to.have.property('enum');
				expect(res.body.color.enum).to.be.deep.equal([{id: 'red', title: 'Red'}, {id: 'green', title: 'Green'}, {id: 'blue', title: 'Blue'}, {id: 'yellow', title: 'Yellow'}]);

				finish();
			});
	});


	it('should get meta information on widgets via ReST (?prototype=true)', function(finish) {
		superagent.get(url + '/api/widgets/meta?prototype=true')
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				expect(res.body).to.be.an('object');

				expect(res.body).to.have.property('$prototype');
				expect(res.body.$prototype).to.be.deep.equal({
					status: 'active',
					color: 'blue',
				});

				finish();
			});
	});
	// }}}

	// POST - create {{{
	var newUser;
	it('should create users via ReST', function(finish) {
		superagent.post(url + '/api/users')
			.send({
				name: 'New User via ReST',
				mostPurchased: [
					{number: 80},
					{number: 90},
				],
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				newUser = res.body;
				expect(newUser).to.be.an('object');

				expect(newUser).to.have.property('_id');
				expect(newUser).to.have.property('__v', 0);
				expect(newUser).to.have.property('name', 'New User via ReST');
				expect(newUser).to.have.property('role', 'user');
				expect(newUser).to.have.property('mostPurchased');
				expect(newUser.mostPurchased).to.be.an('array');
				expect(newUser.mostPurchased).to.have.length(2);
				expect(newUser.mostPurchased[0]).to.have.property('number', 80);
				expect(newUser.mostPurchased[1]).to.have.property('number', 90);

				finish();
			});
	});

	var newWidget;
	it('should create widgets via ReST', function(finish) {
		superagent.post(url + '/api/widgets')
			.send({
				name: 'New Widget',
				content: 'This is a new widget, there are many like it but this one is my own',
				mostPurchased: [
					{number: 7},
				],
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				newWidget = res.body;
				expect(newWidget).to.be.an('object');

				expect(newWidget).to.have.property('_id');
				expect(newWidget).to.have.property('__v', 0);
				expect(newWidget).to.have.property('name', 'New Widget');
				expect(newWidget).to.have.property('content', 'This is a new widget, there are many like it but this one is my own');
				expect(newWidget).to.have.property('status', 'active');
				expect(newWidget).to.have.nested.property('mostPurchased.0.number', 7);


				finish();
			});
	});
	// }}}

	// POST - update {{{
	it('should save over an existing record via ReST (simple update)', function(finish) {
		superagent.post(url + '/api/widgets/' + newWidget._id)
			.send({
				status: 'deleted',
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var widget = res.body;
				expect(widget).to.be.an('object');

				expect(widget).to.have.property('_id', newWidget._id);
				expect(widget).to.have.property('__v', 1);
				expect(widget).to.have.property('name', 'New Widget');
				expect(widget).to.have.property('status', 'deleted');

				finish();
			});
	});

	it('should save over an existing record via ReST (dotted notation)', function(finish) {
		superagent.post(url + '/api/widgets/' + newWidget._id)
			.send({
				'mostPurchased.0.number': 109,
			})
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				var widget = res.body;
				expect(widget).to.be.an('object');

				expect(widget).to.have.property('_id', newWidget._id);
				expect(widget).to.have.property('__v', 2);
				expect(widget).to.have.property('name', 'New Widget');
				expect(widget).to.have.nested.property('mostPurchased.0.number', 109);

				finish();
			});
	});
	// }}}

	// DELETE {{{
	it('should delete an existing widget via ReST', function(finish) {
		superagent.delete(url + '/api/widgets/' + newWidget._id)
			.end(function(err, res) {
				expect(err).to.be.not.ok;

				superagent.get(url + '/api/widgets')
					.query({
						name: 'New Widget',
					})
					.end(function(err, res) {
						if (err) return next(err);
						expect(err).to.be.not.ok;
						expect(res.body).to.be.an('array');
						expect(res.body).to.have.length(0);

						finish();
					});
			});
	});
	// }}}
});
