Common Recipes
==============
Below are some general tips-and-tricks for using Monoxide.


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
