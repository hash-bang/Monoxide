Common Recipes
==============
Below are some general tips-and-tricks for using Monoxide.


Extending Models
----------------
You can add your own model functions via the `static` function on the model.

	// Define your user schema
	var Users = monoxide
		.schema('users', {
			name: String,
			role: {type: String, enum: ['user', 'admin'], default: 'user'},
		})
		.static('countByType', function(type, next) {
			Users.count({
				$collection: 'users',
				role: type,
			}, next);
		});

In the above example we define the `countByType` method which we can call in our controllers:

	Users.countByType('user', function(err, count) {
		console.log('There are', count, 'users');
	});


Remap DELETE operations to set a field
--------------------------------------
Instead of completely removing a record from the database the following code changes the delete operation to instead set the `status` field to `deleted`.

	monoxide.express.defaults({
		delete: function(req, res, next) {
			monoxide.save({
				$collection: req.monoxide.collection,
				$id: req.monoxide.id,
				status: 'deleted',
			}, function(err) {
				if (err) return res.status(400).send(err).end();
				res.send({});
			});
		},
	});

The above assumes that you want this behaviour applied globally (if not just set it for the `delete` property of each `monoxide.middleware.express` call) and that every model you expose has a `status` field which can be set to `deleted`.
