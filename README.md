**THIS PROJECT IS CURRENTLY IN BETA - FUNCTIONS ARE LIKELY TO CHANGE WITHOUT NOTICE - USE WITH CAUTION**


Monoxide
=========
A less poisonous to work with Mongo.

Monoxide attempts to provide nicer, chainable functionality on top of base Mongo while making some of the more C centric designs of Mongo more Node like.


Key differences from Mongoose:

* Provides an out-of-the-box [Express middleware](#rest-server)
* Returns a nicer syntax for [specifying schemas](#schema-setup)
* Sort + Populate functionality can now be specified as an array rather than only as space delimited strings


Comparisons to other frameworks

* The [ReST server](#rest-server) provides various callback middleware layers to perform various restriction lockdowns - e.g. selectively provide queries or only delete records if the user is an admin.


See the [ideas list](ideas.md) for future ideas.


TODO
----

- [x] monoxide.query(q, opts, cb)
- [x] GET /api/:model
- [x] monoxide.save(q, opts, cb)
- [x] POST /api/:model
- [x] POST /api/:model/:id
- [x] monoxide.count(q, opts, cb)
- [x] GET /api/:model/count
- [x] mongolid.delete(q, opts, cb)
- [x] DELETE /api/:model/:id
- [ ] PUT /api/:model/:id
- [ ] PATCH /api/:model/:id
- [ ] GET advanced queries e.g. `{"name":{"$regex":"^(Bob)"}}`
- [x] monoxide.model() - query builder
- [x] monoxide.schema(model, schema) - schema builder
- [x] monoxide.express.middleware restrictions - get, save etc. as functions
- [ ] Support for other data types (number, string, object, array, any)
- [ ] Late bound `$populate` functionality


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

	app.use('/api/users/:id?', monoxide.express.middleware('users', {
		collection: 'users',

		get: true, // Allow retrieval by ID
		query: true, // Allow retrieval of multiple records as a query
		count: true, // Allow record counting via query
		save: false, // Allow saving via POST / PATCH / PUT
		delete: false, // Allow record deletion via DELETE

		// ... other options here ... //
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
	app.post('/api/users', monoxide.express.save('users'));
	app.delete('/api/users/:id', monoxide.express.delete('users'));

In the above the specified models are bound to their respective ReST end points (`GET /api/users` will return all users for example).
