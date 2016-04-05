var _ = require('lodash');
var async = require('async-chainable');
var expect = require('chai').expect;
var monoxide = require('..');
var scenario = require('mongoose-scenario');

// The Database URI to use for tests
var mongoURI = 'mongodb://localhost/monoxide-test';

// Setting this to FALSE will disable the database teardown (i.e. not erase the Schema + DB when done)
// This is useful for debugging but only with single scripts as each test script will expect a fresh database
var allowTeardown = true;

module.exports = {
	// init {{{
	init: function(finish) {
		var self = module.exports;

		async()
			.then(self.initConnection)
			.then(self.initSchemas)
			.then(self.initScenarios)
			.end(finish);
	},
	// }}}

	// teardown {{{
	teardown: function(finish) {
		var self = module.exports;
		if (!allowTeardown) {
			console.log('Skipping teardown');
			return finish();
		}

		async()
			.then(self.teardownSchemas)
			.then(self.teardownConnection)
			.end(finish);
	},
	// }}}

	// initConnection {{{
	initConnection: function(finish) {
		monoxide.connect(mongoURI, finish);
	},
	// }}}

	// initSchemas {{{
	initSchemas: function(finish) {
		// Users {{{
		var Users = monoxide
			.schema('users', {
				name: String,
				role: {type: String, enum: ['user', 'admin'], default: 'user'},
				_password: String,
				favourite: {type: 'pointer', ref: 'widgets'},
				items: [{type: 'pointer', ref: 'widgets'}],
				mostPurchased: [
					{
						number: {type: Number, default: 0},
						item: {type: 'pointer', ref: 'widgets'},
					}
				],
				settings: {
					lang: {type: String, enum: ['en', 'es', 'fr'], default: 'en'},
					greeting: String,
				},
			})
			.method('splitNames', function() {
				return this.name.split(/\s+/);
			})
			.method('randomWait', function(next) {
				// Test function to wait a random amount of MS then return the name
				var doc = this;
				setTimeout(function() {
					next(null, doc.name);
				}, _.random(0, 100));
			})
			.static('countByType', function(type, next) {
				Users.count({
					$collection: 'users',
					role: type,
				}, next);
			})
			.virtual('password', function() { return 'RESTRICTED' }, function(pass) {
				// Very crappy, yet predictable password hasher that removes all consonants
				this._password = pass
					.toLowerCase()
					.replace(/[^aeiou]+/g, '');
			})
			.virtual('passwordStrength', function() {
				// Returns the length of the (badly, see above) password which is an approximate indicator of strength
				return (this._password.length || 0);
			})
		// }}}

		// Widgets {{{
		var Widgets = monoxide.schema('widgets', {
			name: String,
			content: String,
			status: {type: 'string', enum: ['active', 'deleted'], default: 'active'},
			color: {type: 'string', enum: ['red', 'green', 'blue', 'yellow'], default: 'blue', index: true},
		});
		// }}}

		// Groups {{{
		var Groups = monoxide.schema('groups', {
			name: String,
			users: [{type: 'pointer', ref: 'users'}],
			preferences: {
				defaults: {
					items: [{type: 'pointer', ref: 'widgets'}]
				}
			},
		});
		// }}}

		finish();
	},
	// }}}

	// initScenarios {{{
	initScenarios: function(finish) {
		scenario.import({
			// Users {{{
			users: [
				{
					_ref: 'users.joe',
					name: 'Joe Random',
					role: 'user',
					favourite: 'widget-crash',
					items: ['widget-bang'],
					_password: 'ue', // INPUT: flume
					mostPurchased: [
						{
							number: 5,
							item: 'widget-crash',
						},
						{
							number: 10,
							item: 'widget-bang',
						},
						{
							number: 15,
							item: 'widget-whollop',
						},
					],
				},
				{
					_ref: 'users.jane',
					name: 'Jane Quark',
					role: 'user',
					favourite: 'widget-bang',
					items: [],
					_password: 'oeaeoeae', // INPUT: correct battery horse staple
					mostPurchased: [
						{
							number: 1,
							item: 'widget-bang',
						},
						{
							number: 2,
							item: 'widget-whollop',
						},
					],
				},
			],
			// }}}
			// Widgets {{{
			widgets: [
				{
					_ref: 'widget-crash',
					name: 'Widget crash',
					content: 'This is the crash widget',
					// color: 'blue', // Should default to this via schema
				},
				{
					_ref: 'widget-bang',
					name: 'Widget bang',
					content: 'This is the bang widget',
					color: 'red',
				},
				{
					_ref: 'widget-whollop',
					name: 'Widget whollop',
					content: 'This is the whollop widget',
					color: 'blue',
				}
			],
			// }}}
			// Groups {{{
			groups: [
				{
					name: 'Group Foo',
					users: ['users.joe'],
					preferences: {
						defaults: {
							items: ['widget-whollop', 'widget-bang'],
						},
					},
				},
				{
					name: 'Group Bar',
					users: ['users.jane'],
					preferences: {
						defaults: {
							items: ['widget-crash', 'widget-bang'],
						},
					},
				},
				{
					name: 'Group Baz',
					users: ['users.joe', 'users.jane'],
					preferences: {
						defaults: {
							items: ['widget-bang'],
						},
					},
				},
			],
			// }}}
		}, {
			connection: monoxide.connection,
			nuke: true,
		}, function(err, data) {
			expect(err).to.be.not.ok;
			finish();
		});
	},
	// }}}

	// teardownConnection {{{
	teardownConnection: function(finish) {
		monoxide.connection.close(finish);
	},
	// }}}

	// teardownSchemas {{{
	teardownSchemas: function(finish) {
		async()
			.set('models', ['users', 'widgets', 'groups'])
			.forEach('models', function(next, id) {
				monoxide.connection.db.dropCollection(id, next);
			})
			.forEach('models', function(next, id) { // Remove the model from Mongoose's schema cache otherwise it complains we are creating it twice
				delete monoxide.connection.models[id];
				next();
			})
			.then(function(next) {
				monoxide.connection.db.dropDatabase(next);
			})
			.end(finish);
	},
	// }}}
};
