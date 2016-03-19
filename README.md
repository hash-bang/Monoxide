**THIS PROJECT IS CURRENTLY IN BETA - FUNCTIONS ARE LIKELY TO CHANGE WITHOUT NOTICE - USE WITH CAUTION**


Monoxide
=========
A less poisonous to work with Mongo.

Monoxide attempts to provide nicer, chainable functionality on top of base Mongo while making some of the more C centric designs of Mongo more Node like.


1. [API documentation](API.md)
2. [ReST server setup](#reset-server)
3. [Example setups](examples/)
4. [Common recipes and design patterns](RECIPES.md)
4. [TODO list](TODO.md)
5. [Future ideas](IDEAS.md)


Key differences from Mongoose / MongoDB-Core:

* Provides an out-of-the-box [Express middleware](#rest-server)
* Returns a nicer syntax for [specifying schemas](#schema-setup)
* Sort + Populate functionality can now be specified as an array rather than only as space delimited strings
* All documents are accessible as plain JavaScript objects
* Virtuals are handled locally (not on the database)
* Methods are handled locally (again not on the database)


Comparisons to other frameworks

* The [ReST server](#rest-server) provides various callback middleware layers to perform various restriction lockdowns - e.g. selectively provide queries or only delete records if the user is an admin.


See the [ideas list](ideas.md) for future ideas.


Schema Setup
============
Monoxide supports setting the `type` property via a string instead of using pointers to types within the `mongoose.Types` structure.

	var Users = monoxide.schema('users', {
		name: String,
		role: {type: String, enum: ['user', 'admin'], default: 'user'},
		favourite: {type: 'pointer', ref: 'widgets'},
		items: [{type: 'pointer', ref: 'widgets'}],
		mostPurchased: [{
			number: {type: Number, default: 0},
			item: {type: 'pointer', ref: 'widgets'},
		}],
	});

Note that the awkward `mongoose.Schema.ObjectId` type is replaced with the nicer `'pointer'` type specified as a string. All other types can be similarly specified (e.g. `"number"`, `"string"` etc.).

Schemas are also automatically compiled and returned as an object from `monoxide.schema` without any need to perform additional actions on the schema before its usable.



ReST Server
===========
The primary interface to Monoxide is the ReST server interface for Express:

	var express = require('express');
	var monoxide = require('monoxide');

	var app = express();

	app.use('/api/doodads/:id?', monoxide.express.middleware('doodads'));
	app.use('/api/widgets/:id?', monoxide.express.middleware('widgets'));


You can also pass more complex options structures by specifying an object:

	var express = require('express');
	var monoxide = require('monoxide');

	var app = express();

	app.use('/api/users/:id?', monoxide.express.middleware({
		collection: 'users',

		get: true, // Allow retrieval by ID
		query: true, // Allow retrieval of multiple records as a query
		count: true, // Allow record counting via query
		create: false, // Alow record creation via POST / PUT
		save: false, // Allow saving via POST / PATCH
		delete: false, // Allow record deletion via DELETE

		// ... other options here ... //
	}));


You can also secure the various methods by passing in middleware:

	app.use('/api/users/:id?', monoxide.express.middleware('users', {
		get: true, // Allow retrieval by ID
		create: false, // Dont allow record creation
		query: false, // Dont allow querying of users (direct ID addressing is ok though)
		count: false, // Disable counting

		query: true, // Allow retrieval of multiple records as a query

		save: function(req, res, next) {
			// User must be logged in AND be either the right user OR an admin to save user info
			if (
				(req.user && req.user._id) && // Logged in AND
				(
					req.user._id == req.user._id || // Is the same user thats being saved (saving own profile) OR
					req.user.role == 'admin' // User is an admin
				)
			) return next();
			return res.status(403).send('Not logged in').end();
		},

		delete: function(req, res, next) {
			// Only allow delete if the query contains 'force' as a string
			if (req.query.force && req.query.force === 'confirm') return next();
			return res.status(403).send('Nope!').end();
		},
	}));


Cherry-picking middleware
-------------------------
You can also pick-and-choose the handlers to be used:

	var express = require('express');
	var monoxide = require('monoxide');

	var app = express();

	app.get('/api/users', monoxide.express.query('users'));
	app.get('/api/users/count', monoxide.express.count('users'));
	app.get('/api/users/:id', monoxide.express.get('users'));
	app.post('/api/users', monoxide.express.create('users'));
	app.post('/api/users/:id', monoxide.express.save('users'));
	app.delete('/api/users/:id', monoxide.express.delete('users'));

In the above the specified models are bound to their respective ReST end points (`GET /api/users` will return all users for example).


See the [API documentation](API.md) for more detailed information.
