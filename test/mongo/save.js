var expect = require('chai').expect;
var monoxide = require('../..');
var testSetup = require('../setup');


describe('Mongo - save tests', function() {
	before(testSetup.init);

	var users;
	it('should get a list of existing users', function(finish) {
		monoxide.query({
			$collection: 'users',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.instanceOf(Array);
			users = res;
			finish();
		});
	});

	var widgets;
	it('should get a list of existing widgets', function(finish) {
		monoxide.query({
			$collection: 'widgets',
			$sort: 'name',
		}, function(err, res) {
			expect(err).to.be.not.ok;
			expect(res).to.be.an.instanceOf(Array);
			widgets = res;
			finish();
		});
	});

	it('save the status of a user', function(finish) {
		var col = monoxide.connection.collection('users');
		col.updateOne({
			_id: users[0]._id,
		}, {
			$set: {
				role: 'admin',
				items: [widgets[0]._id, widgets[1]._id],
				favourite: widgets[0]._id,
				mostPurchased: [
					{
						number: 50,
						item: widgets[1]._id,
					},
					{
						number: 123,
						item: widgets[0]._id,
					},
				],
			},
		}, finish);
	});

	it('should update the now saved user', function(finish) {
		var col = monoxide.connection.collection('users');
		col.findOneAndUpdate({
			_id: users[0]._id,
		}, {
			$set: {
				role: 'user',
				items: [widgets[1]._id, widgets[0]._id],
				favourite: widgets[1]._id,
				mostPurchased: [
					{
						number: 60,
					},
					{
						number: 200,
					},
				],
			},
		}, function(err, res) {
			console.log('DONE WITH', err, res);
			finish();
		});
	});

	it('should re-get the user record', function(finish) {
		monoxide.models.users.findOneByID(users[0]._id)
			.populate('items')
			.exec(function(err, user) {
				console.log('USER IS', user);
				finish();
			});
	});
});
