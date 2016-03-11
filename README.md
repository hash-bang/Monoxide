**THIS IS CURRENTLY A REQUEST-FOR-COMMENTS WHITE-PAPER**

**THIS PROJECT IS CURRENTLY NON-FUNCTIONAL - PLEASE DO NOT INSTALL IT**


Monoxide
=========
A less poisonous to work with Mongo.

Monoxide attempts to provide nicer, chainable functionality on top of base Mongo while making some of the more C centric designs of Mongo more Node like.

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
- [ ] monoxide.express.middleware restrictions - restrict, restrictQuery



ReST Server
===========
The primary interface to Monoxide is the ReST server interface for Express:


		var express = require('express');
		var monoxide = require('monoxide');

		var app = express();

		app.get('/api/users', monoxide.express.get('users'));
		app.get('/api/users/count', monoxide.express.count('users'));
		app.get('/api/users/:id', monoxide.express.get('users'));
		app.post('/api/users', monoxide.express.save('users'));
		app.delete('/api/users/:id', monoxide.express.delete('users'));

In the above the specified models are bound to their respective ReST end points (`GET /api/users` will return all users for example).

You can also pass more complex options structures by specifying an object:

		app.get('/api/users', monoxide.restGet({
			collection: 'users',
			// ... other options here ... //
		}));



Features
========


Proper chainability
-------------------
While libraries like Mongoose provide some chainable methods they don't quite work as expected. For example

	users
		.find()
		.populate('widgets')
		.where('widgets.enabled', true)
		.exec(handler);

Will *not* work in Mongo or Mongoose due to the way that populate is a late binding. Monoxide however will see that widgets needs populating THEN the where needs to be executed later on and actually make all this work.


Deep population
---------------
With Mongo / Mongoose at present you are limited to the first-layer-only of population.

For example assuming you had three collections: `foo`, `bar` and `baz` each having a foreign key linking them all together. The temptation is to do something like this during a retrieval:

	foo
		.find()
		.populate('bar')
		.populate('bar.baz');
		.exec(handler)

However that will not work. Only the first level of population (in this case `foo.bar`) will be executed. The second level (`foo.bar.baz`) will not be actioned. Worse than that - it will also fail silently.

Monoxide supports multi-level population automatically. The final handler (`exec()`) will only be invoked when all requested populations are executed first.


JavaScript style casing
-----------------------
As Mongo is C based some of the methods, properties or functions using first-letter-caps rather than the Node style camelCasing.

Monoxide rewrites the cases to work in a more Node-y way.

Here are some examples:

| Mongoose                      | Monoxide                                |
|-------------------------------|------------------------------------------|
| `mongoose.Schema.ObjectId`    | `monoxide.types.id`                     |
| `mongoose.Schema`             | `monoxide.schema` or `monoxide.define` |
| `mongoose.Schema.Types.Mixed` | `monoxide.types.mixed`                  |


Hooks that actually work
------------------------
Mongo / Mongoose provide very rudimentary hooks like `model.pre('save', callback)` which work *some of the time* (in the example this hook **wont** trigger if the document is being saved on an insert for example). Monoxide extends the hook capability by using the [Node EventEmitter](http://nodejs.org/api/events.html#events_class_events_eventemitter) to provide much-needed event support.

| Hook                     | Supported by Mongo                                    | Description                                                                   |
|--------------------------|-------------------------------------------------------|-------------------------------------------------------------------------------|
| `save`                   | as `.pre('save', cb)` but only for document creation  | Trigger `callback(row, next)` for a document save - on modify or creation     |
| `postsave`               | as `.post('save', cb)` but without next handling      | Trigger `callback(row, next)` after a document save - on modify or creation   |
| `create`                 | as `.pre('save', cb)`                                 | Trigger `callback(row, next)` on the creation of a new document               |
| `postcreate`             | as `.post('save', cb)` but without next handling      | Trigger `callback(row, next)` on after the creation of a new document         |
| `modify`                 | No                                                    | Trigger `callback(row, next)` on the modification of an existing document     |
| `postmodify`             | No                                                    | Trigger `callback(row, next)` after the modification of an existing document  |
| `change`                 | No                                                    | Trigger `callback(field, row, next)` on a individual field change             |
| `change-schema`          | No                                                    | Trigger `callback(row, next)` when any field changes in the specified schema  |
| `change-schema-field`    | No                                                    | Trigger `callback(field, next)` when the specified field changes in the specified schema |

In addition to simple `on()` support Mogol supports all the usual [EventEmitter](http://nodejs.org/api/events.html#events_class_events_eventemitter) functionality such as `once()`, listener support etc.


Hooks that fire on field changes
--------------------------------
As with the above hooks for general schema manipulation it is now also possible to detect changes to individual changes.

Previously in Mongo / Mongoose this functionality had to be accomplished by wrapping an entire `.pre('save', cb)` handler, now we can listen for specific field changes using `.on('change', cb)`.

See the above section for details on the `change` event.


Virtuals that work asynchronously
---------------------------------
Virtuals are a great feature but the lack of async support in Node makes writing non-blocking scripts difficult.

Monoxide patches this functionality by making all Virtuals async - both getters and setters.

	userSchema
		.virtual('password')
			.get(function(next) {
				// Do something async
				next(null, 'valueOfPassword');
			})
			.set(function(value, next) {
				// Do something async
				next();
			});

In the above the field `password` is a virtual which can now operate async on the retrieved / set value before resuming the operation.


Tidier schema creation
----------------------
Mongo requires that the schema be created before the object is created but the syntax for this operation is pretty messy.

One way is to create the schema using the new `define()` functionality:

	mongrol.define('user', {
		id: mongoose.Schema.ObjectId,
		email: {type: String, required: true, index: {unique: true}},
		passhash: {type: String},
		passsalt: {type: String},
		name: {type: String},
		contact: {
			phone: {type: String},
			mobile: {type: String},
		},
		status: {type: String, enum: ['active', 'deleted'], default: 'active'},
		role: {type: String, enum: ['user', 'admin', 'root'], default: 'user'},
		created: {type: Date, default: Date.now},
	});

Or fields can be defined individually in a chain using `define()` + `field()`:

	monoxide.define('user')
		.field('id', mongrol.types.id)
		.field('email', monoxide.types.string)
		.field('passhash', monoxide.types.string)
		.field('passsalt', monoxide.types.string)
		.field('name', monoxide.types.string)
		.field('contact', monoxide.types.object, {
			phone: {type: monoxide.types.string},
			mobile: {type: monoxide.types.string},
		})
		.field('status', monoxide.types.string, {enum: ['active', 'deleted'], default: 'active'})
		.field('role', monoxide.types.string, {enum: ['user', 'admin', 'root'], default: 'user'})
		.field('created', monoxide.types.date, {default: Date.now});

Or by using Monoxides pluggable type system:

	monoxide.define('user')
		.id('id')
		.string('email')
		.string('passhash')
		.string('passsalt')
		.string('name')
		.object('contact', {
			phone: {type: monoxide.types.string},
			mobile: {type: monoxide.types.string},
		})
		.string('status', {enum: ['active', 'deleted'], default: 'active'})
		.string('role', {enum: ['user', 'admin', 'root'], default: 'user'})
		.date('created', {default: Date.now});


Field transforms
----------------
Assuming you wanted to rewrite a value before it hits the database Monoxide can asynchronously rewrite the incoming value on a per field basis without using hooks.

For example:

	monoxide.define('widgets')
		.string('status', {
			transform: function(value, next) {
				// Do something complicated
				next(null, 'newValue');
			}
		});


Multiple field functions
------------------------
Instead of just one validation or transform function multiple functions can be defined per field.

For example:

	monoxide.define('widgets')
		.string('status', {
			validate: [
				function(value, next) {
					// Do something complicated
					next(); // Assume no issues - use next('My error') if validation fails
				},
				function(value, next) {
					// Do something else complicated
					next(); // No issues here either
				},
			]
		});


Late binding of field functions
-------------------------------
Hooks and field functions can also be attached after the schema definition stage.

This is accomplished using the same definition syntax. If a schema is already defined with the given name Monoxide will attach the new functionality to the existing schema.

For example:

	// Assume that 'users' has already been defined elsewhere

	monoxide.define('users')
		.field('password', {
			changed: function(value, next) {
				// Do something when user password changes
			}
		});

Alternatively the event system can also be used via [EventEmitter](http://nodejs.org/api/events.html#events_class_events_eventemitter):

	monoxide.on('change-users-password', function(next) {
		// Password has changed
		next();
	});


Functional operators
--------------------
There are certain database operations which are so common they should be provided at the driver level.

Below are some query functions which can be used directly within Monoxide without plugins.


| Function                          | Description                                                           |
|-----------------------------------|-----------------------------------------------------------------------|
| `max(field, function)`            | Return the minimum value of the selected field                        |
| `min(field, function)`            | Return the maximum value of the selected field                        |
| `sum(field, function)`            | Return the sum value of the selected field                            |


DWIM selection syntax
---------------------
There are certain places in Mongo / Mongoose where selectors do not seem to have the desired results.

For example:

	db.users.find({
		auth: {
			tokens: {
				token: 'abc124'
			}
		}
	}, callback);

Does not work. The reason is that Mongo expects all selectors to be written in dotted notation as follows:


	db.users.find({
		'auth.tokens.token': 'abc124'
	}, callback);

Monoxide builds on the [DWIM](https://en.wikipedia.org/wiki/DWIM) philosophy where certain functionality is handled by Monoxide to get the expected results.

Monoxide supports *both* of these formats allowing you to be as explicit as you require in your selection functions. Monoxide will rewrite complex array selects (see first example) into dotted notation before passing the aggregate query onto the Mongo driver.



Other ideas
===========

* ForEach ability on returned record. Combines `.exec() + found.forEach()`. Possibly uses a generator or something so we dont have to hold the entire found result set in memory
