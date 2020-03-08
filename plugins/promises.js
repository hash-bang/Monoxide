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
			'meta',
			'remove',
			'update',
		].forEach(method => m[method] = promisify(m[method]));

		// Special case for some weird function aliases
		m.findOneByID = id => m.find({$id: id});
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
