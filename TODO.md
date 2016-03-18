TODO
====

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
- [x] monoxide.express.middleware restrictions - get, save etc. as functions
- [ ] Support for other data types (number, string, object, array, any)
- [ ] Late bound `$populate` functionality
- [ ] monoxide.express.middleware - field blocking
- [ ] monoxide.express.middleware - `all` request filter
- [ ] monoxide.schema.static()
- [x] monoxide.model().create
- [ ] monoxide.model().findOne
- [ ] monoxide.model().findOneByID
- [ ] monoxide.document
- [ ] monoxide.document.save()
