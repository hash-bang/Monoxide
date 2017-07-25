Angular always returns nothing when working with complex objects
================================================================
When sending a complex query string Monoxide prefers the jQuery parameter serializer.

To set this globally in Angular inject the following code somewhere in your bootstrapping scripts:

```javascript
// Force $http query encoding to use the jQuery like encoder (necessary to work with complex objects with a Monoxide backend)
.config($httpProvider => $httpProvider.defaults.paramSerializer = '$httpParamSerializerJQLike');
```
