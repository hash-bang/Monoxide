**THIS IS CURRENTLY A REQUEST-FOR-COMMENTS WHITE-PAPER**

**THIS PROJECT IS CURRENTLY NON-FUNCTIONAL - PLEASE DO NOT INSTALL IT**


Mongol
======
A nicer way to work with Mongo.

Mongol attempts to provide nicer, chainable functionality on top of base Mongo while making some of the more C centric designs of Mongo more Node like.


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

Will *not* work in Mongo or Mongoose due to the way that populate is a late binding. Mongol however will see that widgets needs populating THEN the where needs to be executed later on and actually make all this work.


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

Mongol supports multi-level population automatically. The final handler (`exec()`) will only be invoked when all requested populations are executed first.


JavaScript style casing
-----------------------
As Mongo is C based some of the methods, properties or functions using first-letter-caps rather than the Node style camelCasing.

Mongol rewrites the cases to work in a more Node-y way.

Here are some examples:

| Mongoose                      | Mongol                                |
|-------------------------------|---------------------------------------|
| `mongoose.Schema.ObjectId`    | `mongol.types.id`                     |
| `mongoose.Schema`             | `mongol.schema` or `mongol.define`    |
| `mongoose.Schema.Types.Mixed` | `mongol.types.mixed`                  |


Hooks that actually work
------------------------
Mongo / Mongoose provide very rudimentary hooks like `model.pre('save', callback)` which work *some of the time* (in the example this hook **wont** trigger if the document is being saved on an insert for example). Mongol extends the hook capability by using the [Node EventEmitter](http://nodejs.org/api/events.html#events_class_events_eventemitter) to provide much-needed event support.

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

Mongol patches this functionality by making all Virtuals async - both getters and setters.

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

	mongol.define('user')
		.field('id', mongrol.types.id)
		.field('email', mongol.types.string)
		.field('passhash', mongol.types.string)
		.field('passsalt', mongol.types.string)
		.field('name', mongol.types.string)
		.field('contact', mongol.types.object, {
			phone: {type: mongol.types.string},
			mobile: {type: mongol.types.string},
		})
		.field('status', mongol.types.string, {enum: ['active', 'deleted'], default: 'active'})
		.field('role', mongol.types.string, {enum: ['user', 'admin', 'root'], default: 'user'})
		.field('created', mongol.types.date, {default: Date.now});

Or by using Mongols pluggable type system:

	mongol.define('user')
		.id('id')
		.string('email')
		.string('passhash')
		.string('passsalt')
		.string('name')
		.object('contact', {
			phone: {type: mongol.types.string},
			mobile: {type: mongol.types.string},
		})
		.string('status', {enum: ['active', 'deleted'], default: 'active'})
		.string('role', {enum: ['user', 'admin', 'root'], default: 'user'})
		.date('created', {default: Date.now});


Field transforms
----------------
Assuming you wanted to rewrite a value before it hits the database Mongol can asynchronously rewrite the incoming value on a per field basis without using hooks.

For example:

	mongol.define('widgets')
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

	mongol.define('widgets')
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

This is accomplished using the same definition syntax. If a schema is already defined with the given name Mongol will attach the new functionality to the existing schema.

For example:

	// Assume that 'users' has already been defined elsewhere

	mongol.define('users')
		.field('password', {
			changed: function(value, next) {
				// Do something when user password changes
			}
		});

Alternatively the event system can also be used via [EventEmitter](http://nodejs.org/api/events.html#events_class_events_eventemitter):

	mongol.on('change-users-password', function(next) {
		// Password has changed
		next();
	});


Functional operators
--------------------
There are certain database operations which are so common they should be provided at the driver level.

Below are some query functions which can be used directly within Mongol without plugins.


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

Mongol builds on the [DWIM](https://en.wikipedia.org/wiki/DWIM) philosophy where certain functionality is handled by Mongol to get the expected results.

Mongol supports *both* of these formats allowing you to be as explicit as you require in your selection functions. Mongol will rewrite complex array selects (see first example) into dotted notation before passing the aggregate query onto the Mongo driver.
