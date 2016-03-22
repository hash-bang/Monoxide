# connect

Connect to a Mongo database

**Parameters**

-   `uri` **string** The URL of the database to connect to
-   `callback` **function** Optional callback when connected, if omitted this function is syncronous

Returns **monoxide** The Monoxide chainable object

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

## monoxide.express.create

Return an Express middleware binding for POST/PUT operations which create a new record
Unless you have specific routing requirements its better to use monoxide.express.middleware() as a generic router

**Parameters**

-   `model` **[string]** The model name to bind to (this can also be specified as settings.collection)
-   `settings` **[Object]** Middleware settings
    -   `settings.collection` **[string]** The model name to bind to

**Examples**

```javascript
// Bind an express method to create widgets
app.post('/api/widgets', monoxide.express.create('widgets'));
```

Returns **function** callback(req, res, next) Express compatible middleware function

## monoxide.express.defaults

Set the default settings used when calling other monoxide.express.middleware functions
The provided settings will be merged with the existing defaults, so its possible to call this function multiple times to override previous invocations
NOTE: This will only effect functions called AFTER it was invoked.

**Parameters**

-   `model` **[string]** The model name to bind to (this can also be specified as settings.collection)
-   `settings` **[Object]** Middleware settings

**Examples**

```javascript
// Enable saving globally
monoxide.express.defaults({save: true});
```

```javascript
// Add a middleware function to all delete operations (assuming the invidiual controllers dont override it)
monoxide.express.defaults({
	delete: function(req, res, next) {
		// Check the user is logged in - deny otherwise
		if (!req.user) return res.status(403).send('You are not logged in').end();
		next();
	},
});
```

Returns **monoxide** This chainable monoxide instance

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

See monoxide.express.defaults() to chanthe the default settings for this function globally

**Parameters**

-   `model` **[string]** The model name to bind to (this can also be specified as settings.collection)
-   `settings` **[Object]** Middleware settings
    -   `settings.collection` **[string]** The model name to bind to
    -   `settings.count` **[boolean or monoxide.express.middlewareCallback]** Allow GET + Count functionality (optional, default `true`)
    -   `settings.get` **[boolean or monoxide.express.middlewareCallback]** Allow single record retrieval by its ID via the GET method. If this is disabled an ID MUST be specified for any GET to be successful within req.params (optional, default `true`)
    -   `settings.query` **[boolean or monoxide.express.middlewareCallback]** Allow record querying via the GET method (optional, default `true`)
    -   `settings.create` **[boolean or monoxide.express.middlewareCallback]** Allow the creation of records via the POST method (optional, default `false`)
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

Return an Express middleware binding for POST/PATCH operations which update an existing record with new fields
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

# monoxide.create

Create a new Mongo document and return it
If you wish to save an existing document see the monoxide.save() function.

**Parameters**

-   `q` **Object** The object to process
    -   `q.$collection` **string** The collection / model to query
    -   `q.field` **[...Any]** Any other field (not beginning with '$') is treated as data to save
-   `options` **[Object]** Optional options object which can alter behaviour of the function
-   `function`  (err,result)] Optional callback to call on completion or error
-   `callback`  

**Examples**

```javascript
// Create a Widget
monoxide.save({
	$collection: 'widgets',
	name: 'New widget name',
}, function(err, widget) {
	console.log('Created widget is', widget);
});
```

Returns **Object** This chainable object

# monoxide.delete

Delete a Mongo document by its ID
This function has two behaviours - it will, by default, only delete a single record by its ID. If `q.$multiple` is true it will delete by query.
If `q.$multiple` is false and the document is not found (by `q.$id`) this function will execute the callback with an error

**Parameters**

-   `q` **Object** The object to process
    -   `q.$collection` **string** The collection / model to query
    -   `q.$id` **[string]** The ID of the document to delete (if you wish to do a remove based on query set q.$query=true)
    -   `q.$multiple` **[boolean]** Allow deletion of multiple records by query
-   `options` **[Object]** Optional options object which can alter behaviour of the function
-   `function`  (err,result)] Optional callback to call on completion or error
-   `callback`  

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

# monoxide.monoxideDocument

Returns a single instance of a Monoxide document

**Parameters**

-   `setup` **Object** The prototype fields. Everything in this object is extended into the prototype
    -   `setup.$collection` **string** The collection this document belongs to
-   `data` **Object** The initial data

Returns **monoxide.monoxideDocument** 

# monoxide.query

Query Mongo directly with the Monoxide query syntax

**Parameters**

-   `q` **Object** The object to process
    -   `q.$id` **[string]** If specified return only one record by its master ID (implies $one=true). If present all other conditionals will be ignored and only the object is returned (see $one)
    -   `q.$select` **[string or Array&lt;string&gt; or Array&lt;object&gt;]** Field selection criteria to apply
    -   `q.$sort` **[string or Array&lt;string&gt; or Array&lt;object&gt;]** Sorting criteria to apply
    -   `q.$populate` **[string or Array&lt;string&gt; or Array&lt;object&gt;]** Population criteria to apply
    -   `q.$collection` **string** The collection / model to query
    -   `q.$limit` **[number]** Limit the return to this many rows
    -   `q.$skip` **[number]** Offset return by this number of rows
    -   `q.filter` **[...Any]** Any other field (not beginning with '$') is treated as filtering criteria
    -   `q.$one` **[boolean]** Whether a single object should be returned (implies $limit=1). If enabled an object is returned not an array (optional, default `false`)
-   `options` **[Object]** Optional options object which can alter behaviour of the function
    -   `options.cacheFKs` **[boolean]** Whether to cache the foreign keys (objectIDs) within an object so future retrievals dont have to recalculate the model structure (optional, default `true`)
-   `callback` **function** (err, result) the callback to call on completion or error. If $one is truthy this returns a single monoxide.monoxideDocument, if not it returns an array of them

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

# monoxide.queryBuilder

Returns data from a Monoxide model

**Parameters**

-   `options` **[Object]** Optional options object which can alter behaviour of the function

Returns **monoxide.queryBuilder** 

# monoxide.save

Save an existing Mongo document by its ID
If you wish to create a new document see the monoxide.create() function.
If the existing document ID is not found this function will execute the callback with an error

**Parameters**

-   `q` **Object** The object to process
    -   `q.$collection` **string** The collection / model to query
    -   `q.$id` **string** The ID of the document to save
    -   `q.field` **[...Any]** Any other field (not beginning with '$') is treated as data to save
-   `options` **[Object]** Optional options object which can alter behaviour of the function
    -   `options.refetch` **[boolean]** Whether to refetch the record after update, false returns `null` in the callback (optional, default `true`)
-   `function`  (err,result)] Optional callback to call on completion or error
-   `callback`  

**Examples**

```javascript
// Save a Widget
monoxide.save({
	$collection: 'widgets',
	$id: 1234,
	name: 'New name',
}, function(err, widget) {
	console.log('Saved widget is now', widget);
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
	role: {type: 'string', enum: ['user', 'admin'], default: 'user'},
	favourite: {type: 'pointer', ref: 'widgets'},
	items: [{type: 'pointer', ref: 'widgets'}],
	settings: {type: 'any'},
	mostPurchased: [
		{
			number: {type: 'number', default: 0},
			item: {type: 'pointer', ref: 'widgets'},
		}
	],
});
```

Returns **Object** The monoxide model of the generated schema

# monoxide.update

Update multiple documents

**Parameters**

-   `q` **Object** The object to query by
    -   `q.$collection` **string** The collection / model to query
    -   `q.field` **[...Any]** Any other field (not beginning with '$') is treated as filter data
-   `qUpdate` **Object** The object to update into the found documents
    -   `qUpdate.field` **[...Any]** Data to save into every record found by `q`
-   `options` **[Object]** Optional options object which can alter behaviour of the function
-   `function`  (err,result)] Optional callback to call on completion or error
-   `callback`  

**Examples**

```javascript
// Set all widgets to active
monoxide.update({
	$collection: 'widgets',
	status: 'active',
});
```

Returns **Object** This chainable object

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

# findOneById

Alias of findOneByID

# fire

Execute all hooks for an event
This function fires all hooks in parallel and expects all to resolve correctly via callback
NOTE: Hooks are always fired with the callback as the first argument

**Parameters**

-   `name` **string** The name of the hook to invoke
-   `callback` **function** The callback to invoke on success
-   `parameters` **...Any** Any other parameters to be passed to each hook

# hasHook

Return whether a model has a specific hook
If an array is passed the result is whether the model has none or all of the specified hooks

**Parameters**

-   `hooks` **string or array or undefined or ** The hook(s) to query, if undefined or null this returns if any hooks are present

Returns **boolean** Whether the hook(s) is present

# hasVirtuals

Return whether a model has virtuals

Returns **boolean** Whether any virtuals are present

# hook

Attach a hook to a model
A hook is exactly the same as a eventEmitter.on() event but must return a callback
Multiple hooks can be attached and all will be called in parallel on certain events such as 'save'
All hooks must return non-errors to proceed with the operation

**Parameters**

-   `eventName`  
-   `callback`  

Returns **monoxide.monoxideModel** The chainable monoxideModel

# method

Add a method to a all documents returned from this model
A method is a user defined function which extends the `monoxide.monoxideDocument` prototype

**Parameters**

-   `name` **string** The function name to add as a static method
-   `func` **function** The function to add as a static method

Returns **monoxide.monoxideModel** The chainable monoxideModel

# monoxide.monoxideMode.update

Shortcut to invoke update on a given model

**Parameters**

-   `q` **Object** The filter to query by
-   `qUpdate` **Object** The object to update into the found documents
-   `options` **[Object]** Optional options object which can alter behaviour of the function
-   `function`  (err,result)] Optional callback to call on completion or error
-   `callback`  

Returns **Object** This chainable object

# monoxide.monoxideModel.create

Shortcut function to create a new record within a collection

**Parameters**

-   `q` **[Object]** Optional document contents
-   `options` **[Object]** Optional options object which can alter behaviour of the function
-   `callback` **[function]** Optional callback

Returns **monoxide.monoxideModel** The chainable monoxideModel

# monoxide.monoxideModel.find

Shortcut function to create a monoxide.queryBuilder object and immediately start filtering

**Parameters**

-   `q` **[Object]** Optional filtering object
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** 

# monoxide.monoxideModel.find

Shortcut function to create a monoxide.queryBuilder object and immediately start filtering
This also sets $count=true in the queryBuilder

**Parameters**

-   `q` **[Object]** Optional filtering object
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** 

# monoxide.monoxideModel.findOne

Shortcut function to create a monoxide.queryBuilder object and immediately start filtering
This also sets $one=true in the queryBuilder

**Parameters**

-   `q` **[Object]** Optional filtering object
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** 

# monoxide.monoxideModel.findOneByID

Shortcut function to create a monoxide.queryBuilder object and immediately start filtering
This also sets $id=q in the queryBuilder

**Parameters**

-   `q` **[Object]** Optional filtering object
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** 

# monoxide.monoxideModel.remove

Shortcut function to remove a number of rows based on a query

**Parameters**

-   `q` **[Object]** Optional filtering object
-   `callback` **[function]** Optional callback

Returns **monoxide** 

# static

Add a static method to a model
A static is a user defined function which extends the `monoxide.monoxideModel` prototype

**Parameters**

-   `name` **string** The function name to add as a static method
-   `func` **function** The function to add as a static method

Returns **monoxide.monoxideModel** The chainable monoxideModel

# virtual

Define a virtual (a handler when a property gets set or read)

**Parameters**

-   `name` **string or Object** The virtual name to apply or the full virtual object (must pretain to the Object.defineProperty descriptor)
-   `getCallback` **function** The get fnution to call when the virtual value is read
-   `setCallback` **function** The set function to call when the virtual value changes

Returns **monoxide.monoxideModel** The chainable monoxideModel

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

# monoxide.queryBuilder.exec

Execute the query and return the error and any results

**Parameters**

-   `callback` **function** (err,result)

Returns **monoxide.queryBuilder** This chainable object

# monoxide.queryBuilder.find

Add a filtering function to an existing query

**Parameters**

-   `q` **[Object or function]** Optional filtering object or callback (in which case we act as exec())
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** This chainable object

# monoxide.queryBuilder.limit

Add limit criteria to an existing query

**Parameters**

-   `q` **number** Limit records to this number
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** This chainable object

# monoxide.queryBuilder.populate

Add population criteria to an existing query

**Parameters**

-   `q` **[Array or string]** Population criteria, for strings or arrays of strings use the field name
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** This chainable object

# monoxide.queryBuilder.skip

Add skip criteria to an existing query

**Parameters**

-   `q` **number** Skip this number of records
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** This chainable object

# monoxide.queryBuilder.sort

Add sort criteria to an existing query

**Parameters**

-   `q` **[Object or Array or string]** Sorting criteria, for strings or arrays of strings use the field name optionally prefixed with '-' for decending search order. For Objects use `{ field: 1|-1|'asc'|'desc'}`
-   `callback` **[function]** Optional callback. If present this is the equivelent of calling exec()

Returns **monoxide.queryBuilder** This chainable object
