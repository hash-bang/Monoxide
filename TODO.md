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
- [x] Support for other data types (number, string, object, array, any)
- [ ] Late bound `$populate` functionality
- [ ] monoxide.express.middleware - field blocking
- [ ] monoxide.express.middleware - `all` request filter
- [x] monoxide.schema.static()
- [x] monoxide.model().create
- [x] monoxide.model().findOne
- [x] monoxide.model().findOneByID
- [x] monoxide.document
- [x] monoxide.document.save()
- [x] monoxide.document.hook('save', cb)
- [ ] Auto reconnection
- [x] Omit fields (e.g. '_' prefix)
- [x] monoxide.use() should load a module ONCE - repeated calls should be ignored
- [x] monoxide.hook() should regisster a hook against all models (context should be the model)


Tests
=====

- [ ] Tidy up calls to extractFKs into a cached schema computed on boot
- [ ] Saving a populated document
- [ ] Saving a nested document
- [ ] Coherce all OIDs into strings on object find
- [ ] Make output Express safe - i.e. omit '$MONOXIDE'
