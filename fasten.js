
var fasten = (function () {

  var components = [];
  var services = [];

  var _createComponent = function (parameters) {

    assert("the 'parameters' parameter is not valid", parameters)
      .ifNull()
      .ifUndefined();

    ["view", "name"].forEach(function (item) {
      assert(_f.interpolate("the '${}' parameter is not present or valid", item), parameters[item])
        .ifUndefined()
        .else(!_f.isString(parameters[item]), _f.interpolate("the '${}' property is not a string", item));
    });

    assert("this 'model' parameter is not valid", parameters.model)
      .ifUndefined()
      .ifNull();

    var checkResult = _checkObjectName(parameters["name"]);

    if (!checkResult.isValid) {
      throw _f.interpolate("the 'name' string value is in an incorrect format\nthe name value cannot start with a number or end with '-'\nvalid characters are: a-z, A-z, 0-9, and '-'\ne.g component-1 or fastenComponent1 or fasten-Component2 or Component3-somethingElse\nthe following invalid characters where detected: ${}", checkResult.invalidCharacters.join(", "));
    }

    if (_f.isValid(parameters["deps"]) && !_f.isArray(parameters["deps"])) {
      throw "the 'deps' property must be an array of strings";
    }

    components.push(new WrappedObject(parameters));
  };

  var _createService = function (parameters) {
    assert("the 'parameters' parameter is not valid", parameters)
      .ifNull()
      .ifUndefined();

    assert("the 'name' parameter is not present or valid", parameters.name)
      .ifUndefined()
      .ifNull()
      .else(!_f.isString(parameters.name), "the 'name' property is not a string");

    assert("this 'handler' parameter is not present or valid", parameters.handler)
      .ifUndefined()
      .ifNull()
      .else(!_f.isFunction(parameters.handler));

    var checkResult = _checkObjectName(parameters["name"]);

    if (!checkResult.isValid) {
      throw _f.interpolate("the 'name' string value is in an incorrect format\nthe name value cannot start with a number or end with '-'\nvalid characters are: a-z, A-z, 0-9, and '-'\ne.g object-1 or fastenObject1 or fasten-Object2 or Object3-somethingElse\nthe following invalid characters where detected: ${}", checkResult.invalidCharacters.join(", "));
    }

    if (_f.isValid(parameters["deps"]) && !_f.isArray(parameters["deps"])) {
      throw "the 'deps' property must be an array of strings";
    }

    parameters.model = {};

    new WrappedObject(parameters);
  };

  var _checkObjectName = function (name) {
    var matches = name.match(/[^a-zA-Z-0-9\-]/g);
    var numberMatches = name[0].match(/\d+/g);
    var endDashMatch = name[name.length - 1] === '-';
    var invalidChars = (_f.isValid(matches) ? matches : []).concat(_f.isValid(numberMatches) ? numberMatches : []).concat(endDashMatch ? ['-'] : []);
    return {
      isValid: invalidChars.length === 0,
      invalidCharacters: invalidChars
    };
  };

  function WrappedObject(object) {
    this.__callback = null;
    var $this = this;
    this.model = object.model;

    var promise = _f.resolve("promise");
    var deferred = _f.isValid(promise) ? promise.defer() : null;
            
    _f.extend(this, {
      onPropertyChanged: function (callback) {
        if (!_f.isValid(callback) || !_f.isFunction(callback)) return;
        $this.__callback = callback;
      },
      hasProperty: function (propertyName) {
        return _f.isValid($this._object[propertyName]);
      },
      addProperties: function (properties, exclusions, ignore) {
        var excl = !_f.isValid(exclusions) && !_f.isArray(exclusions) ? [] : exclusions;
        var blackList = !_f.isValid(ignore) && !_f.isArray(ignore) ? [] : ignore;

        Object.keys(properties).forEach(function (key) {
          if (blackList.indexOf(key) !== -1) return;
          if (excl.indexOf(key) !== -1) {
            if (_f.isFunction(properties[key])) {
              $this[key] = _wrapFunction(properties[key], $this.model);
            }
            else {
              $this[key] = properties[key];
            }
            return;
          }
          if (_f.isFunction(properties[key])) {
            $this[key] = _wrapFunction(properties[key], $this.model);
          }
          else {
            var field = "_" + key;
            
            // define properties on wrapper object when key === 'model'
            
            $this[field] = properties[key];
            Object.defineProperty($this.model, key, {
              enumerable: true,
              get: function () {
                return $this[field];
              },
              set: function (value) {
                if ($this[field] === value) return;
                $this[field] = value;
                if (!_f.isValid($this.__callback)) return;
                $this.__callback({
                  property: key,
                  value: value
                });
              }
            });
          }
        });
      }
    });

    if(_f.isValid(deferred)) this.onPropertyChanged(deferred.resolve);

    this.addProperties(object, ["name", "view", "controller", "deps"], ["handler"]);

    if (_f.isValid(this.view)) {
      
      deferred.promise.success(function(data) {
        var elements = _f.DOM.find($this.name);
        _f.array.forEach(elements, function(element) {
          element.innerHTML = _f.interpolate($this.view, $this.model);
        });
      });
      
      var viewCheckResult = _checkViewString(this.view);
      var elements = _f.DOM.find($this.name);
      if (viewCheckResult.isHtml) {
        _f.array.forEach(elements, function (element) {
          if (_f.isValid(element)) {
            element.innerHTML = _f.interpolate($this.view, $this.model);
          }
        });
      }
      else if (viewCheckResult.isUrl) {
        var ajax = _f.resolve("ajax");
        ajax.get(this.view).then(function (html) {
           $this.view = html;
          _f.array.forEach(elements, function (element) {
            if (_f.isValid(element)) {
              element.innerHTML = _f.interpolate($this.view, $this.model);;
            }
          });
        }, function () {
          return;
        });
      }
    }
    if (_f.isValid(this.controller) || _f.isValid(object.handler)) {
      var dependencies = (function() {
        var result = [];
        if(!_f.isValid($this.deps)) return [];
        var dependenciesObject = _f.resolve($this.deps);
        _f.array.forEach($this.deps, function(item) {
          result.push(dependenciesObject[item]);
        });
        return result;
      })();
      if (_f.isValid(this.controller)) this.controller.apply(this, dependencies);
      if (_f.isValid(object.handler)) {
        var serviceConstructor = function () {
          var instance = {};
          object.handler.apply(instance, dependencies);
          return instance;
        };
        var service = _f.extend(serviceConstructor(), { name: this.name });
        services.push(service);
      }
    }
  };

  var _wrapFunction = function (fn, model) {
    return function () {
      fn.apply(model, arguments);
    };
  };

  var _valueCheck = function (type) {
    return function (object) {
      return typeof object === type;
    }
  };

  var _nameValue = function (name, value) {
    return {
      name: name,
      value: value
    };
  };

  var _resolveDependencies = function (dependenciesArray) {
    if (!_f.isArray(dependenciesArray)) throw "the 'dependenciesArray' parameter must be an array";

    var result = [];

    dependenciesArray.forEach(function (dependency) {
      if (!_f.array.any(components, { name: dependency }) && !_f.array.any(services, { name: dependency })) {
        throw _f.interpolate("cannot find the '${}' dependency", dependency);
      }
      else {
        var objects = [].concat(components).concat(services);
        result = _f.array.where(objects, { name: dependency });
      }
    });

    return result;
  };

  var _checkViewString = function (viewString) {
    var urlMatch = viewString.match(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/g);
    var htmlMatch = viewString.match(/^<([a-z]+)([^<]+)*(?:>(.*)<\/\1>|\s+\/>)$/g);
    return {
      isUrl: _f.isValid(urlMatch) ? urlMatch.length > 0 : false,
      isHtml: _f.isValid(htmlMatch) ? htmlMatch.length > 0 : false
    };
  }

  var _arrayParameterCheck = function (array, parameters) {
    var result = false;
    if (!_f.isValid(array) || !_f.isArray(array)) return result;
    if (!_f.isValid(parameters)) {
      result = array.length > 0;
    }
    else if (_f.isFunction(parameters)) {
      result = true;
    }
    return result;
  }

  var _f = {
    extend: function (source, values) {

      [_nameValue("source", source), _nameValue("values", values)].forEach(function (parameter) {

        assert(_f.interpolate("the '${}' parameter is not valid", parameter.name), parameter.value)
          .ifUndefined()
          .ifNull()
          .else(!_f.isArray(parameter.value) && !_f.isObject(parameter.value), "not an object or an array");

      });

      if (_f.isArray(values)) {
        values.forEach(function (item) {
          Object.keys(item).forEach(function (key) {
            source[key] = item[key];
          });
        });
      }
      else {
        Object.keys(values).forEach(function (key) {
          source[key] = values[key];
        });
      }

      return source;
    },
    isArray: function (object) {
      return Array.isArray(object);
    },
    isValid: function (object) {
      return object !== null && object !== undefined;
    },
    isString: _valueCheck("string"),
    isNumber: _valueCheck("number"),
    isBoolean: _valueCheck("boolean"),
    isObject: _valueCheck("object"),
    isFunction: _valueCheck("function"),
    interpolate: function (string, values) {
      if (!_f.isValid(string)) throw "the 'string' parameter cannot be null or undefined";
      if (!_f.isString(string)) throw "the 'string' parameter must be a string value";

      if (!_f.isValid(values)) throw "the 'values' parameter cannot be null or undefined";

      var result = string;
      if (_f.isString(values)) {
        result = result.replace("${}", values);
      }
      else if (_f.isObject(values)) {
        Object.keys(values).forEach(function (key) {
          result = result.replace("${" + key + "}", values[key]);
        });
      }
      else if (_f.isArray(values)) {
        for (var index in values) {
          result = result.replace("${" + index + "}", values[index]);
        }
      }
      else {
        throw "the 'values' parameter is not valid";
      }
      return result;
    },
    fromJson: function (json) {
      if (_f.isString(json)) throw "the 'json' parameter must be a string value";
      return JSON.parse(json);
    },
    toJson: function (object) {
      if (!_f.isValid(object)) return "{}";
      return JSON.stringify(object);
    },
    resolve: function (objectNames) {
      assert("the 'objectNames' parameter is not valid", objectNames)
        .ifUndefined()
        .ifNull()
        .else(!_f.isArray(objectNames) && !_f.isString(objectNames), "the 'objectNames' parameter is not an array or a string");

      var object = {};
      if (_f.isArray(objectNames)) {
        objectNames.forEach(function (name) {
          object[name] = _f.array.first(components, { name: name });
          if (!_f.isValid(object[name])) object[name] = _f.array.first(services, { name: name });
        });
        return object;
      }
      else if (_f.isString(objectNames)) {
        var result = _f.array.first(components, { name: objectNames });
        if (!_f.isValid(result)) result = _f.array.first(services, { name: objectNames });
        return result;
      }
    },
    array: {

      any: function (array, predicate) {
        return _f.array.where(array, predicate).length > 0;
      },

      count: function (array, predicate) {
        return _f.array.where(array, predicate).length;
      },

      first: function (array, predicate) {
        var result = _f.array.where(array, predicate);
        return result.length > 0 ? result[0] : null;
      },

      forEach: function (collection, iterator) {
        if (!_f.isValid(collection)) throw "the 'collection' parameter is not valid";
        if (!_f.isFunction(iterator) && !_f.isFunction(iterator)) throw "the 'iterator' parameter must be a function";

        for (var x in collection) {
          if (x.match(/\d+/g)) iterator(collection[x], x);
        }

      },

      select: function (array, selector) {
        var result = _arrayParameterCheck(array, selector);
        var data = [];
        if (!result) {
          if (!_f.isArray(selector) || !_f.isString(selector)) return data;
        }
        var length = array.length;
        var isFunction = _f.isFunction(selector);
        var isString = _f.isString(selector);
        var ifArray = _f.isArray(selector);
        for (var x = 0; x < length; x++) {
          if (isFunction) {
            data.push(selector(array[x]));
          }
          else if (isString) {
            var item = array[x][selector];
            if (_f.isValid(item)) data.push(item);
          }
          else if (isArray) {
            var item = null;
            var object = {};
            selector.forEach(function (property) {
              item = array[x][property];
              object[property] = _f.isValid(item) ? item : null;
            });
            data.push(object);
          }
        }
        return data;
      },

      where: function (array, predicate) {
        var result = _arrayParameterCheck(array, predicate);
        var data = [];
        if (!result) {
          if (!_f.isObject(predicate)) return data;
        }
        var isObject = _f.isObject(predicate);
        var isFunction = _f.isFunction(predicate);
        var length = array.length;
        var keys = Object.keys(predicate);
        var item = null;
        for (var x = 0; x < length; x++) {
          item = array[x];
          if (isFunction) {
            if (predicate(item)) data.push(item);
          }
          else if (isObject) {
            var matchCount = 0;
            Object.keys(item).forEach(function (key) {
              if (keys.indexOf(key) === -1) return;
              if (item[key] === predicate[key]) matchCount++;
            });
            if (keys.length === matchCount) data.push(item);
          }
        }
        return data;
      }

    },

    DOM: {
      find: function (selector) {
        assert("the 'selector' parameter is not valid", selector)
          .ifUndefined()
          .ifNull()
          .else(!_f.isString(selector), "the 'selector' parameter must be a string");

        return document.querySelectorAll(selector);
      }
    }

  };


  var assert = function (description, value) {
    var assertFunction = function (boolean, fallbackMessage) {
      return function (message) {
        var msg = message;
        if (!_f.isValid(msg)) msg = fallbackMessage;
        if (boolean) throw _f.interpolate(description + "; ${}", msg);
        return assertionObject;
      };
    };

    var assertionObject = {
      ifNull: assertFunction(value === null, "the supplied value is null"),

      ifUndefined: assertFunction(value === undefined, "the supplied value is undefined"),

      ifNaN: assertFunction(isNaN(value), "the supplied value is not a number (NaN)"),

      ifStringEmpty: assertFunction(value === "", "the supplied string value is empty"),

      else: function (boolean, message) {
        if (boolean) throw _f.interpolate(description + "; ${}", message);
        return assertionObject;
      }

    };

    return assertionObject;
  };

  _f.extend(_f, {
    component: _createComponent,
    service: _createService
  });

  _f.service({
    name: "promise",
    handler: function () {

      var $this = this;

      _f.extend(this, {
        all: function (promises) {
          assert("the 'promises' parameter must be valid", promises)
            .ifUndefined()
            .ifNull()
            .else(!_f.isArray(promises));

          var defer = $this.defer();
          var calledCount = 0;
          var successDataArray = [];
          var errorDataArray = [];

          var promiseCallback = function (dataArray) {
            return function (data) {
              dataArray.push(data);
              calledCount++;
              if (calledCount === promises.length) {
                promises.success(successDataArray);
                promises.fail(errorDataArray);
              }
            };
          };

          promises.forEach(function (promise) {
            promise.success(promiseCallback(successDataArray));
            promise.fail(promiseCallback(errorDataArray));
          });
          return defer;
        },
        defer: function () {
          var _error = null;
          var _notify = null;
          var _success = null;
          return {
            promise: {
              fail: function (callback) {
                _error = callback;
              },
              success: function (callback) {
                _success = callback;
              },
              then: function (success, error, notify) {
                _success = success;
                _error = error;
                _notify = notify;
              }
            },
            notify: function (data) {
              if (_f.isValid(_notify)) _notify(data);
            },
            resolve: function (data) {
              if (_f.isValid(_success)) _success(data);
            },
            reject: function (data) {
              if (_f.isValid(_error)) _error(data);
            }
          };
        }
      });
    }
  });

  _f.service({
    name: "ajax",
    deps: ["promise"],
    handler: function (promise) {
      var ajax = _f.isValid(XMLHttpRequest) ?
        new XMLHttpRequest() :
        new ActiveXObject("Microsoft.XMLHTTP");

      var _createFunction = function (httpMethod) {
        return function (url, parameters, success, error) {
          var deferred = promise.defer();
          ajax.onerror = function (data) {
            if (_f.isValid(error)) error(data);
            deferred.reject(data);
          };
          ajax.onreadystatechange = function () {
            if (ajax.readyState === XMLHttpRequest.DONE && ajax.status === 200) {
              if (_f.isValid(success)) success(ajax.responseText);
              deferred.resolve(ajax.responseText);
            }
          };
          ajax.open(httpMethod, url, true);
          ajax.setRequestHeader("Content-Type", "application/json");
          ajax.send(parameters);
          return deferred.promise;
        };
      };

      _f.extend(this, {
        get: _createFunction("GET"),
        post: _createFunction("POST"),
        put: _createFunction("PUT"),
        header: _createFunction("HEADER"),
        delete: _createFunction("DELETE")
      });
    }
  });

  _f.service({
    name: "timer",
    handler: function () {
      var $this = this;
      var _callback = null;
      var _timerHandler = null;
      _f.extend($this, {
        onTicked: function (callback) {
          _callback = callback;
        },
        start: function (interval) {
          _timerHandler = setInterval(function () {
            _callback();
          }, interval);
        },
        stop: function () {
          if (_f.isValid(_timerHandler)) window.clearInterval(_timerHandler);
        }
      });
    }
  });

  return _f;
})();

window.fasten = fasten;

/*if(exports) {
  module.exports = fasten;
}*/
