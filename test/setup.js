var async = require('async-chainable');
var expect = require('chai').expect;
var mongoose = require('mongoose');
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
		mongoose.connect('mongodb://localhost/mongoloid-test', finish);
		mongoose.connection.on('error', console.error.bind(console, 'DB connection error:'));
	},
	// }}}

	// initSchemas {{{
	initSchemas: function(finish) {
		// User {{{
		var userSchema = new mongoose.Schema({
			id: mongoose.Schema.ObjectId,
			name: String,
			role: {type: String, enum: ['user', 'admin'], default: 'user'},
			favourite: {type: mongoose.Schema.ObjectId, ref: 'widgets'},
			items: [{type: mongoose.Schema.ObjectId, ref: 'widgets'}],
			mostPurchased: [
				{
					number: {type: Number, default: 0},
					item: {type: mongoose.Schema.ObjectId, ref: 'widgets'},
				}
			],
		});
		var User = mongoose.model('users', userSchema);
		// }}}

		// Widget {{{
		var widgetSchema = new mongoose.Schema({
			id: mongoose.Schema.ObjectId,
			name: String,
			content: String,
			status: {type: String, enum: ['active', 'deleted'], default: 'active'},
		});
		var Widget = mongoose.model('widgets', widgetSchema);
		// }}}

		// Group {{{
		var groupSchema = new mongoose.Schema({
			id: mongoose.Schema.ObjectId,
			name: String,
			preferences: {
				defaults: {
					items: [{type: mongoose.Schema.ObjectId, ref: 'widgets'}]
				}
			},
		});
		var Group = mongoose.model('groups', groupSchema);
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
				},
				{
					_ref: 'widget-bang',
					name: 'Widget bang',
					content: 'This is the bang widget',
				},
				{
					_ref: 'widget-whollop',
					name: 'Widget whollop',
					content: 'This is the whollop widget',
				}
			],
			// }}}
		}, {
			connection: mongoose.connection,
			nuke: true,
		}, function(err, data) {
			expect(err).to.be.not.ok;
			finish();
		});
	},
	// }}}
};
