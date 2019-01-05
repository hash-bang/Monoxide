/**
* Plugin which transforms most Monoxide objects into promise returns
*/
var promisify = require('util').promisify;

module.exports = function(finish, o) {
	// Promisify all module methods
	[
		'connect',
		'disconnect',
		'create',
		'update',
		'delete',
		'meta',
		'runCommand',
		'save',
	].forEach(method => o[method] = promisify(o[method]));


	// Promisify all model methods
	o.on('modelCreate', (model, m) => {
		[
			'aggregate',
			'checkIndexes',
			'create',
			'distinct',
			'getIndexes',
			'getSchemaIndexes',
			'remove',
			'update',
			'findOneByID',
		].forEach(method => m[method] = promisify(m[method]));

		m.findOneByID = id => new Promise((resolve, reject) => {
			if (!id) return reject('No ID specified');
			o.internal.query({$collection: model, $id: id}, (err, result) => {
				if (err) return reject(err);
				resolve(result);
			});
		});
	});


	// Promisify all document methods
	o.on('documentCreate', doc => {
		[
			'delete',
			'populate',
			'remove',
			'save',
		].forEach(method => doc.__proto__[method] = promisify(doc.__proto__[method]));
	});

	finish();
};
