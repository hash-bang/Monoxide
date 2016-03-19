var _ = require('lodash');
var async = require('async-chainable');
var expect = require('chai').expect;
var monoxide = require('..');
var scenario = require('mongoose-scenario');

var hasSetup = false;

module.exports = {
	// init {{{
	init: function(finish) {
		var self = module.exports;
		if (hasSetup) return finish();

		async()
			.then(self.initConnection)
			.then(self.initSchemas)
			.then(self.initScenarios)
			.end(function(err) {
				if (err) return finish(err);
				hasSetup = true;
				finish();
			});
	},
	// }}}

	// initConnection {{{
	initConnection: function(finish) {
		monoxide.connect('mongodb://localhost/monoxide-test', finish);
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
					preferences: {
						defaults: {
							items: ['widget-whollop', 'widget-bang'],
						},
					},
				},
				{
					name: 'Group Bar',
					preferences: {
						defaults: {
							items: ['widget-crash', 'widget-bang'],
						},
					},
				},
				{
					name: 'Group Baz',
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
};
