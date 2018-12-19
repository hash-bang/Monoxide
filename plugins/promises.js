/**
* Plugin which transforms most Monoxide objects into promise returns
*/
var promisify = require('util').promisify;

module.exports = function(finish, o) {
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

	finish();
};
