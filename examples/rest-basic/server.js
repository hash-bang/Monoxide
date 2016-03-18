var bodyParser = require('body-parser');
var express = require('express');
var monoxide = require('monoxide');
var scenario = require('mongoose-scenario');

// Connect
monoxide.connect('mongodb://localhost/monoxide-test');

// Initalize models
var Widgets = monoxide.schema('widgets', {
	name: String,
	content: String,
	status: {type: String, enum: ['active', 'deleted'], default: 'active'},
	color: {type: String, enum: ['red', 'green', 'blue', 'yellow'], default: 'blue', index: true},
});


// Set up some sample data
scenario.import({
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
}, {connection: monoxide.connection});


// Set up ExpressJS
var port = 8181;
var url = 'http://localhost:' + port;
var app = express();
app.use(bodyParser.json());


// Install the ReST server
app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
	get: true,
	query: true,
	create: true,
	save: true,
	delete: true,
}));


// Boot the server
var server = app.listen(port, null, function(err) {
	if (err) return finish(err);
	console.log('ReST server listening on ' + url);
	console.log();
	console.log('Try some of the following:');
	console.log()
	console.log('     GET ' + url + '/api/widgets - To get a list of all widgets');
	console.log('     GET ' + url + '/api/widgets/ID - To get a specific widget');
	console.log('     GET ' + url + '/api/widgets/?color=blue - To query widgets');
	console.log('    POST ' + url + '/api/widgets - create a new widget')
	console.log('    POST ' + url + '/api/widgets/ID - save to an existing widget')
	console.log('  DELETE ' + url + '/api/widgets/ID - delete an existing widget')
	console.log();
});
