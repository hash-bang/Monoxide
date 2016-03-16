# express

## monoxide.express.count

Return an Express middleware binding for GET operations - specifically for returning COUNTs of objects
Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router

**Parameters**

-   `model` **[string]** The model name to bind to (this can also be specified as settings.collection)
-   `settings` **[Object]** Middleware settings
    -   `settings.collection` **[string]** The model name to bind to

**Examples**

```javascript
// Bind an express method to count widgets
app.get('/api/widgets/count', monoxide.express.get('widgets'));
```

Returns **function** callback(req, res, next) Express compatible middleware function

## monoxide.express.delete

Return an Express middleware binding for DELETE operations
Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router

**Parameters**

-   `model` **[string]** The model name to bind to (this can also be specified as settings.collection)
-   `settings` **[Object]** Middleware settings
    -   `settings.collection` **[string]** The model name to bind to

**Examples**

```javascript
// Bind an express method to delete widgets
app.delete('/api/widgets/:id', monoxide.express.delete('widgets'));
```

Returns **function** callback(req, res, next) Express compatible middleware function

## monoxide.express.get

Return an Express middleware binding for single record retrieval operations
Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router

**Parameters**

-   `model` **[string]** The model name to bind to (this can also be specified as settings.collection)
-   `settings` **[Object]** Middleware settings
    -   `settings.collection` **[string]** The model name to bind to
    -   `settings.queryRemaps` **[string]** Object of keys that should be translated from the incomming req.query into their Monoxide equivelents (e.g. `{populate: '$populate'`})

**Examples**

```javascript
// Bind an express method to serve widgets
app.get('/api/widgets/:id?', monoxide.express.get('widgets'));
```

Returns **function** callback(req, res, next) Express compatible middleware function

## monoxide.express.middleware

Return an Express middleware binding

**Parameters**

-   `model` **[string]** The model name to bind to (this can also be specified as settings.collection)
-   `settings` **[Object]** Middleware settings
    -   `settings.collection` **[string]** The model name to bind to
    -   `settings.count` **[boolean or monoxide.express.middlewareCallback]** Allow GET + Count functionality (optional, default `true`)
    -   `settings.get` **[boolean or monoxide.express.middlewareCallback]** Allow single record retrieval by its ID via the GET method. If this is disabled an ID MUST be specified for any GET to be successful within req.params (optional, default `true`)
    -   `settings.query` **[boolean or monoxide.express.middlewareCallback]** Allow record querying via the GET method (optional, default `true`)
    -   `settings.save` **[boolean or monoxide.express.middlewareCallback]** Allow saving of records via the POST method (optional, default `false`)
    -   `settings.delete` **[boolean or monoxide.express.middlewareCallback]** Allow deleting of records via the DELETE method (optional, default `false`)

**Examples**

```javascript
// Bind an express method to serve widgets
app.use('/api/widgets/:id?', monoxide.express.middleware('widgets'));
```

```javascript
// Bind an express method to serve users but disallow counting and querying (i.e. direct ID access only)
app.use('/api/users/:id?', monoxide.express.middleware('users', {query: false, count: false}));
```

Returns **function** callback(req, res, next) Express compatible middleware function

## monoxide.express.query

Return an Express middleware binding for multiple record retrieval operations
Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router

**Parameters**

-   `model` **[string]** The model name to bind to (this can also be specified as settings.collection)
-   `settings` **[Object]** Middleware settings
    -   `settings.collection` **[string]** The model name to bind to
    -   `settings.queryRemaps` **[string]** Object of keys that should be translated from the incomming req.query into their Monoxide equivelents (e.g. `{populate: '$populate'`})

**Examples**

```javascript
// Bind an express method to serve widgets
app.get('/api/widgets', monoxide.express.query('widgets'));
```

Returns **function** callback(req, res, next) Express compatible middleware function

## monoxide.express.save

Return an Express middleware binding for POST operations
Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router

**Parameters**

-   `model` **[string]** The model name to bind to (this can also be specified as settings.collection)
-   `settings` **[Object]** Middleware settings
    -   `settings.collection` **[string]** The model name to bind to

**Examples**

```javascript
// Bind an express method to save widgets
app.post('/api/widgets/:id', monoxide.express.save('widgets'));
```

Returns **function** callback(req, res, next) Express compatible middleware function

# monoxide.count

Similar to query() but only return the count of possible results rather than the results themselves

**Parameters**

-   `q` **Object** The object to process
    -   `q.$collection` **string** The collection / model to query
    -   `q.filter` **[...Any]** Any other field (not beginning with '$') is treated as filtering criteria
-   `options` **[Object]** Optional options object which can alter behaviour of the function
-   `callback` **function** (err,count) the callback to call on completion or error

**Examples**

```javascript
// Count all Widgets
monoxide.count({$collection: 'widgets'}, function(err, count) {
	console.log('Number of Widgets:', count);
});
```

```javascript
// Count all admin Users
monoxide.query({$collection: 'users', role: 'admin'}, function(err, count) {
	console.log('Number of Admin Users:', count);
});
```

Returns **Object** This chainable object

# monoxide.delete

Delete a Mongo document by its ID
This function will first attempt to retrieve the ID and if successful will delete it, if the document is not found this function will execute the callback with an error

**Parameters**

-   `q` **Object** The object to process
    -   `q.$collection` **string** The collection / model to query
    -   `q.$id` **string** The ID of the document to delete
-   `options` **[Object]** Optional options object which can alter behaviour of the function
-   `callback` **function** (err, result) the callback to call on completion or error

**Examples**

```javascript
// Save a Widgets
monoxide.query({$collection: 'widgets', name: 'New name'}, function(err, res) {
	console.log('Saved widget:', res);
});
```

Returns **Object** This chainable object

# monoxide.express.middlewareCallback

Callback function for Express middleware
This callback applies to the monoxide.express.middleware() function for get, query, save, delete etc.

**Parameters**

-   `req` **Object** The request object
-   `res` **Object** The response object
-   `next` **function** The next callback chain (optional to call this or deal with `res` yourself)

**Examples**

```javascript
// Allow deleting of widgets only if 'force'===true
app.use('/api/widgets/:id?', monoxide.express.middleware('widgets', {
	delete: function(req, res, next) {
		// Only allow delete if the query contains 'force' as a string
		if (req.query.force && req.query.force === 'confirm') return next();
		return res.status(403).send('Nope!').end();
	},
}));
```

# monoxide.model

Return a defined Monoxide model
The model must have been previously defined by monoxide.schema()
This function is identical to accessing the model directly via `monoxide.models[modelName]`

**Parameters**

-   `model` **string** The model name (generally lowercase plurals e.g. 'users', 'widgets', 'favouriteItems' etc.)

Returns **Object** The monoxide model of the generated schema

# monoxide.queryBuilder

Returns data from a Monoxide model

**Parameters**

-   `options` **[Object]** Optional options object which can alter behaviour of the function

Returns **monoxide.queryBuilder** 

# monoxide.save

Save a Mongo document by its ID
This function will first attempt to retrieve the ID and if successful will save, if the document is not found this function will execute the callback with an error

**Parameters**

-   `q` **Object** The object to process
    -   `q.$collection` **string** The collection / model to query
    -   `q.$id` **string** The ID of the document to save
    -   `q.field` **[...Any]** Any other field (not beginning with '$') is treated as data to save
-   `options` **[Object]** Optional options object which can alter behaviour of the function
-   `callback` **function** (err, result) the callback to call on completion or error

**Examples**

```javascript
// Save a Widgets
monoxide.query({$collection: 'widgets', name: 'New name'}, function(err, res) {
});
```

Returns **Object** This chainable object

# monoxide.schema

Construct and return a Mongo model
This function creates a valid schema specificaion then returns it as if model() were called

**Parameters**

-   `model` **string** The model name (generally lowercase plurals e.g. 'users', 'widgets', 'favouriteItems' etc.)
-   `spec` **Object** The schema specification composed of a hierarhical object of keys with each value being the specification of that field

**Examples**

```javascript
// Example schema for a widget
var Widgets = monoxide.schema('widgets', {
	name: String,
	content: String,
	status: {type: String, enum: ['active', 'deleted'], default: 'active'},
	color: {type: String, enum: ['red', 'green', 'blue'], default: 'blue', index: true},
});
```

```javascript
// Example schema for a user
var Users = monoxide.schema('users', {
	name: String,
	role: {type: String, enum: ['user', 'admin'], default: 'user'},
	favourite: {type: 'pointer', ref: 'widgets'},
	items: [{type: 'pointer', ref: 'widgets'}],
	mostPurchased: [
		{
			number: {type: Number, default: 0},
			item: {type: 'pointer', ref: 'widgets'},
		}
	],
});
```

Returns **Object** The monoxide model of the generated schema

# monoxide.utilities.extractFKs

Extract all FKs in dotted path notation from a Mongoose model

**Parameters**

-   `schema` **Object** The schema object to examine (usually connection.base.models[model].schema
-   `prefix` **string** existing Path prefix to use (internal use only)
-   `base` **Object** Base object to append flat paths to (internal use only)

Returns **Object** A dictionary of foreign keys for the schema (each key will be the info of the object)

# monoxideModel

**Parameters**

-   `options`  

# Monoxide

# monoxide.aggregate

Perform a direct aggregation and return the result

**Parameters**

-   `q` **Object** The object to process
    -   `q.$stages` **array** The aggregation stages array
        -   `q.$stages.$project` **[Object]** Fields to be supplied in the aggregation (in the form `{field: true}`)
            -   `q.$stages.$project._id` **[boolean]** If true surpress the output of the `_id` field (optional, default `false`)
        -   `q.$stages.$match` **[Object]** Specify a filter on fields (in the form `{field: CRITERIA}`)
        -   `q.$stages.$redract` **[Object]** 
        -   `q.$stages.$limit` **[Object]** 
        -   `q.$stages.$skip` **[Object]** 
        -   `q.$stages.$group` **[Object]** 
        -   `q.$stages.$sample` **[Object]** 
        -   `q.$stages.$sort` **[Object]** Specify an object of fields to sort by (in the form `{field: 1|-1}` where 1 is ascending and -1 is decending sort order)
        -   `q.$stages.$geoNear` **[Object]** 
        -   `q.$stages.$lookup` **[Object]** 
        -   `q.$stages.$out` **[Object]** 
        -   `q.$stages.$indexStats` **[Object]** 
        -   `q.$stages.$unwind` **[Object]** 
    -   `q.$collection` **string** The collection / model to query
-   `options` **[Object]** Optional options object which can alter behaviour of the function
-   `callback` **function** (err, result) the callback to call on completion or error

Returns **Object** This chainable object

# monoxide.get

Retrieve a single record from a model via its ID
This function will ONLY retrieve via the ID field, all other fields are ignored
NOTE: Really this function just wraps the monoxide.query() function to provide functionality like populate

**Parameters**

-   `q` **Object** The object to process
    -   `q.$collection` **string** The collection / model to query
    -   `q.$id` **[string]** The ID to return
    -   `q.$populate` **[string or Array&lt;string&gt; or Array&lt;object&gt;]** Population criteria to apply
-   `id` **[string]** The ID to return (alternative syntax)
-   `options` **[Object]** Optional options object which can alter behaviour of the function
-   `callback` **function** (err, result) the callback to call on completion or error

**Examples**

```javascript
// Return a single widget by its ID (string syntax)
monoxide.get('widgets', '56e2421f475c1ef4135a1d58', function(err, res) {
	console.log('Widget:', res);
});
```

```javascript
// Return a single widget by its ID (object syntax)
monoxide.get({$collection: 'widgets', $id: '56e2421f475c1ef4135a1d58'}, function(err, res) {
	console.log('Widget:', res);
});
```

Returns **Object** This chainable object

# monoxide.query

Query Mongo directly with the Monoxide query syntax

**Parameters**

-   `q` **Object** The object to process
    -   `q.$id` **[string]** If specified return only one record by its master ID (implies $one=true). If present all other conditionals will be ignored and only the object is returned (see $one)
    -   `q.$sort` **[string or Array&lt;string&gt; or Array&lt;object&gt;]** Sorting criteria to apply
    -   `q.$populate` **[string or Array&lt;string&gt; or Array&lt;object&gt;]** Population criteria to apply
    -   `q.$one` **[boolean]** Whether a single object should be returned (implies $limit=1). If enabled an object is returned not an array (optional, default `false`)
    -   `q.$collection` **string** The collection / model to query
    -   `q.$skip` **[number]** Offset return by this number of rows
    -   `q.filter` **[...Any]** Any other field (not beginning with '$') is treated as filtering criteria
    -   `q.$limit` **[number]** Limit the return to this many rows
-   `options` **[Object]** Optional options object which can alter behaviour of the function
    -   `options.cacheFKs` **[boolean]** Whether to cache the foreign keys (objectIDs) within an object so future retrievals dont have to recalculate the model structure (optional, default `true`)
-   `callback` **function** (err, result) the callback to call on completion or error

**Examples**

```javascript
// Return all Widgets, sorted by name
monoxide.query({$collection: 'widgets', $sort: 'name'}, function(err, res) {
	console.log('Widgets:', res);
});
```

```javascript
// Filter Users to only return admins while also populating their country
monoxide.query({$collection: 'users', $populate: 'country', role: 'admin'}, function(err, res) {
	console.log('Admin users:', res);
});
```

Returns **Object** This chainable object

# monoxide.queryBuilder.exec

Execute the query and return the error and any results

**Parameters**

-   `callback` **function** (err,result)

Returns **monoxide.queryBuilder** This chainable object

# monoxide.queryBuilder.find

Add a filtering function to an existing query

**Parameters**

-   `q` **[Object]** Optional filtering object
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** This chainable object

# monoxide.queryBuilder.populate

Add population criteria to an existing query

**Parameters**

-   `q` **[Array or string]** Population criteria, for strings or arrays of strings use the field name
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** This chainable object

# monoxide.queryBuilder.sort

Add sort criteria to an existing query

**Parameters**

-   `q` **[Object or Array or string]** Sorting criteria, for strings or arrays of strings use the field name optionally prefixed with '-' for decending search order. For Objects use `{ field: 1|-1|'asc'|'desc'}`
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** This chainable object

# monoxide.monoxideModel.find

Shortcut function to create a monoxide.queryBuilder object and immediately start filtering

**Parameters**

-   `q` **[Object]** Optional filtering object
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** 
