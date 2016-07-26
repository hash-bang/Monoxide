Monoxide
=========
A less poisonous to work with Mongo.

Monoxide attempts to provide nicer, chainable functionality on top of base Mongo while making some of the more C centric designs of Mongo more Node like.

**NOTE: While Monoxide is now mostly stable there are still likely to be bugs. Please report these to the author if found**


1. [API documentation](API.md)
2. [ReST server](#rest-server)
3. [Example setups](examples/)
4. [Common recipes and design patterns](RECIPES.md)
4. [TODO list](TODO.md)
5. [Future ideas](IDEAS.md)


Key differences from Mongoose / MongoDB-Core:

* **ReST server** - Provides an out-of-the-box [Express middleware](#rest-server)
* **Syntax** - Returns a nicer syntax for [specifying schemas](#schema-setup)
* **Query parameters as arrays** - Sort + Populate functionality can now be specified as an array rather than only as space delimited strings
* **Plain objects** - All documents are accessible as plain JavaScript objects
* **Virtuals** - Virtuals are handled locally (not on the database)
* **Methods** - Methods are handled locally (again not on the database)
* **Hooks** - Hooks (i.e. Mongoose `pre`, `post` calls) **actually work as they should**. Hooks like all the above are local and not fired at the database level
* **OIDs / ObjectIDs** - All pointers (or `mongoose.Types.ObjectId` as Mongoose refers to them) are **strings**. Comparison is simple string comparison, there is no need to call `.toString()` on each object. The function still exists if you want an entirely plain object sans all the *glued* functions like `save()`
* Schemas get applied on each document retrieval. Changing the schema of your project no longer leads to documents having 'the old version'. New fields added to the schema *after* document creation will be applied to older documents.
* **ReST field surpression** - By default all fields prefixed with `_` (excepting `_id` and `__v`) are removed from ReST server output. This can be changed by adjusting the `omitFields` setting for `monoxide.express.(middleware|query|get`.
* **Document mapping** - Each output document can be run though the `map` function to decorate it before it leaves the server - this is useful to omit complex things the client doesn't need or otherwise glue information to the document.
* **Callback error if no matching records** - If no matching records are found in a `get()` operation and `$errNotFound` is true (the default) Monoxide will populate the error property of the callback. This is useful to automatically abandon Async chains when an expected record is not found rather than having to do manual check for record existence later.


See the [ideas list](ideas.md) for future ideas.


Schema Setup
============
Monoxide supports setting the `type` property via a string instead of using pointers to types within the `mongoose.Types` structure. Its also really easy to add methods, statics and virtuals using chainable syntax.

	var Users = monoxide
		.schema('users', {
			name: String,
			role: {type: String, enum: ['user', 'admin'], default: 'user'},
			favourite: {type: 'pointer', ref: 'widgets'},
			items: [{type: 'pointer', ref: 'widgets'}],
			mostPurchased: [{
				number: {type: 'number', default: 0},
				item: {type: 'pointer', ref: 'widgets'},
			}],
		})
		.static('countByType', function(type, next) { // Adds User.countByType(TYPE, callback) as a model method
			Users.count({
				$collection: 'users',
				role: type,
			}, next);
		})
		.method('splitNames', function() { // Adds UserDocument.splitNames() as a method
			return this.name.split(/\s+/);
		})
		.virtual('password', function() { return 'RESTRICTED' }, function(pass) { // Adds a password handling virtual
			// Replace this with your own impressive password hashing kung-fu
			this._password = pass;
		})
		.hook('save', function(next, doc) { // Adds a hook for when a document is saved (must fire callback to accept changes)
			console.log('User', doc._id, 'has been modified');
			next();
		})

Note that the awkward `mongoose.Schema.ObjectId` type is replaced with the nicer `'pointer'` type specified as a string. All other types can be similarly specified (e.g. `"number"`, `"string"` etc.).

Schemas are also automatically compiled and returned as an object from `monoxide.schema` without any need to perform additional actions on the schema before its usable. Functions that declare additional operations such as virtuals, statics, methods, hooks etc can be added and removed at any time without recompiling the object.



ReST Server
===========
The primary interface to Monoxide is the ReST server interface for Express:

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


OR you can also bring in only the specific Express middleware thats required:

	var express = require('express');
	var monoxide = require('monoxide');

	var app = express();

	app.use('/api/doodads/:id?', monoxide.express.middleware('doodads'));
	app.use('/api/widgets/:id?', monoxide.express.middleware('widgets'));


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
