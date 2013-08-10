// Minionette.js 0.4
// (c) 2013 Anthony Bennett/
// Released under LGPL v3 (see license.txt)
(function(root, factory) {
	// CommonJS; AMD; Register global
	if ("object" == typeof exports) {
		factory(exports);
	} else if (("function" == typeof define) && define.amd) {
		define(["exports"], factory);
	} else {
		factory(root.Minionette = {});
	}
})(this, function(exports) {
	// standard boilerplate stuff
	var Minionette = exports,
		slice = [].slice;

	Minionette.VERSION = "0.4";
	Backbone.emulateHTTP = true;

	/////////////////////
	// MINIONETTE.BINDALL
	/////////////////////

	var bindAll = Minionette.bindAll = function(obj) {
		_.bindAll.apply(obj, [obj].concat(_.functions(obj)));
	};

	/////////////
	// DO NOTHING
	/////////////

	var doNothing = function(){};

	/////////////////////
	// COLLECTION TO JSON
	/////////////////////

	var collectionToJSON = function(collection) {
		// map it and return it
		return collection.map(function(item) {
			return item.toJSON();
		});
	};

	///////////////////////////
	// SET APPLICATION BINDINGS
	///////////////////////////

	var setApplicationBindings = function(events, context) {
		_.each(events, function(handlers, event) {
			if (event) {
				_.each((_.isArray(handlers) ? handlers : [handlers]), function(handler) {
					var setModelAttr = handler.match(/^model\.(.+)$/);
					context.application.on(event, (setModelAttr ? function(value) {
						context.model.set(setModelAttr[1], value);
					} : context[handler]), context);
				});
			}
		});
	};

	/////////////////////////////
	// CLEAR APPLICATION BINDINGS
	/////////////////////////////

	var clearApplicationBindings = function(context) {
		context.application.off(context, { context: context });
	};

	////////////////
	// SET LISTENERS
	////////////////

	var setListeners = function(obj, events, context) {
		_.each(events, function(handler, event) {
			if (event) {
				_.each((_.isArray(handler) ? handler : [handler]), function(handler2) {
					context.listenTo(obj, event, context[handler2]);
				});
			}
		});
	};

	/////////////////
	// SET COLLECTION
	/////////////////

	var setCollection = function(collection, events, comparator, context) {
		// clear previous listeners and reset collection
		if ("object" == typeof context.collection) {
			context.stopListening(context.collection);
			if (context.collection.length) {
				context.collection.reset();
			}
		}

		// set collection to incoming
		context.collection = collection;

		// initialize as needed
		if ("function" == typeof context.collection) {
			context.collection = new context.collection();
		}

		// set listeners
		setListeners(context.collection, events, context);

		// set comparator, if any
		if (comparator) {
			this.collection.comparator = comparator;
			this.collection.sort()
		}
	};

	////////////
	// SET MODEL
	////////////

	var setModel = function(model, events, context) {
		// if model is not an instance of a backbone model,
		// treat it like a plain object and make it so
		if (("object" == typeof model) && !(model instanceof Backbone.Model)) {
			model = new Backbone.Model(model);
		}

		// clear previous listeners
		// clear previous listeners and reset collection
		if ("object" == typeof context.model) {
			context.stopListening(context.model);
		}

		// set model to incoming
		context.model = model;

		// set listeners
		setListeners(context.model, events, context);
	};

	//////////////
	// SET VISIBLE
	//////////////

	var setVisible = function(context) {
		var type = (typeof context.visible);

		// leave it as-is
		if ("function" == type) {
			return;
		}

		// convert to function if possible
		if ("string" == type) {
			var parts = context.visible.split(".");
			if (parts.length && !_.contains(parts, "") &&
				("undefined" != typeof context[parts[0]])) {
				if (2 == parts.length) {
					// based on a model attribute
					if ("model" == parts[0]) {
						context.visible = function() {
							return context.model.get(parts[1]);
						};
						return;
					}
					// based on a subproperty / function
					context.visible = function() {
						return _.result(context[parts[0]], parts[1]);
					};
					return;
				}
				// based on a property / function
				if (1 == parts.length) {
					context.visible = function() {
						return _.result(context, parts[0]);
					};
					return;
				}
			}
		}

		// otherwise, clear it
		context.visible = null;
	};

	////////////////
	// COMMON REMOVE
	////////////////

	var commonRemove = function(context) {
		context.beforeRemove();
		if (context.leaveEl) {
			context.undelegateEvents();
		} else {
			context.$el.remove();
		}
		context.stopListening();
		clearApplicationBindings(context);
		return context;
	};

	///////////////////
	// COMPILE TEMPLATE
	///////////////////

	var compileTemplate = function(context) {
		if (context.templateEl) {
			context.template = $(context.templateEl).html();
		}
		if (context.template && ("function" != typeof context.template)) {
			context.template = _.template(context.template);
		}
	};

	/////////////////
	// TOGGLE VISIBLE
	/////////////////

	var toggleVisible = function(context) {
		if (context.visible) {
			context.$el.toggle(_.result(context, "visible") ? true : false);
		}
	};

	///////////////
	// VIEW MANAGER
	///////////////

	var ViewManager = function() {
		this.views = [];
		this.names = [];
		this.length = 0;
	};

	// add other methods
	_.extend(ViewManager.prototype, {
		has: function(name) {
			return _.contains(this.names, name);
		},
		add: function(view, name) {
			if (!name) {
				name = _.uniqueId("view");
			}
			this.views.push(view);
			this.names.push(name);
			++this.length;
		},
		remove: function(name) {
			if (!name) {
				name = _.last(this.names);
				if (!name) {
					return;
				}
			}
			var index = _.indexOf(this.names, name);
			if (-1 == index) {
				return;
			}
			var view = this.views.splice(index, 1)[0];
			this.names.splice(index, 1);
			view.remove();
			--this.length;
		},
		clear: function() {
			var view;
			while (view = this.views.pop()) {
				view.remove();
			}
			this.names = [];
			this.length = 0;
		},
		invoke: function(method) {
			var args = slice.call(arguments, 1);
			_.each(this.views, function(view) {
				if ("function" == typeof view[method]) {
					view[method].apply(view, args);
				}
			});
		},
		get: function(name) {
			var index = _.indexOf(this.names, name);
			if (-1 == index) {
				return;
			}
			return this.views[index];
		}
	});

	///////////////
	// SET BINDINGS
	///////////////

	var setBindings = function(events, application) {
		_.each(events, function(handler, event) {
			if (event) {
				_.each((_.isArray(handler) ? handler : [handler]), function(handler2) {
					application.on(event, application[handler2], application);
				});
			}
		});
	};

	/////////////////////////
	// MINIONETTE.APPLICATION
	/////////////////////////

	Minionette.Application = function(userOptions) {
		// keep an internal reference to this;
		// set up options
		var application = this,
			options = _.defaults((userOptions || {}), {
				events: application.events,
				views: application.views,
				links: application.links
			});

		// make sure this always means this
		bindAll(application);

		// reset events
		this.events = {};

		// keep track of views
		this.views = new ViewManager();

		// initialize each view
		_.each(options.views, function(view) {
			var constructor;

			// loop over links, if any
			_.each(options.links, function(link) {
				var fromP;

				// find view in link keys
				if (view != link.from) {
					return;
				}

				fromP = view.prototype;

				// instantiate collection or model on "from" view
				if ("undefined" != typeof fromP.collection) {
					fromP.collection = new fromP.collection();
				} else if ("undefined" != typeof fromP.model) {
					fromP.model = new fromP.model();
				}

				// set collection or model on "to" views
				_.each((_.isArray(link.to) ? link.to : [link.to]), function(to) {
					var toP = to.prototype;

					if ("undefined" != typeof fromP.collection) {
						toP.collection = fromP.collection;
					} else if ("undefined" != typeof fromP.model) {
						toP.model = fromP.model;
					}
				});
			});

			// initialize the view
			view = new view({ application: application });

			// add it to the list
			application.views.add(view);
		});

		// remember how many views we started with
		// (used to clear views added via loadView)
		application.baseViewsCount = application.views.length;

		// bind events
		setBindings(options.events, application);

		// initialize the application itself
		application.initialize.apply(application, _.values(options));

		// now that everything is initialized run
		// any after-initialize functions
		application.views.invoke("afterInitialize");
	};

	// add an extend method
	Minionette.Application.extend = Backbone.Model.extend;

	// add other methods
	_.extend(Minionette.Application.prototype, {
		links: [],
		initialize: doNothing,
		// event bus (inspired by radio.js)
		events: {},
		on: function(name, callback, context) {
			if ("undefined" == typeof this.events[name]) {
				this.events[name] = [];
			}
			this.events[name].push({
				callback: callback,
				context: (context || null)
			});
		},
		off: function(name, options) {
			if ("undefined" == typeof this.events[name]) {
				return;
			}
			if ("object" != typeof options) {
				var event = this.events[name];
				_.each(_.where(event, options), function(remove) {
					event = _.without(event, remove);
				});
				if (event.length) {
					this.events[name] = event;
					return;
				}
			}
			delete this.events[name];
		},
		trigger: function(name) {
			if ("undefined" == typeof this.events[name]) {
				return;
			}
			var args = slice.call(arguments, 1);
			_.each(this.events[name], function(event) {
				event.callback.apply(event.context, args);
			});
		},
		loadView: function(path, data) {
			// if it already exists, reload data
			var view = this.views.get(path);
			if (view && ("function" == typeof view.reload)) {
				view.reload(data);
				return;
			}

			// load path; initialize view;
			// add to views; after-initialize
			var application = this;
			require([path], function(view) {
				view = new view({
					application: application,
					data: data
				});
				application.views.add(view, path);
				if ("function" == typeof view.afterInitialize) {
					view.afterInitialize();
				}
			});
		},
		clearLoadedViews: function() {
			while (this.views.length > this.baseViewsCount) {
				this.views.remove();
			}
		}
	});

	//////////////////
	// MINIONETTE VIEW
	//////////////////

	Minionette.View = Backbone.View.extend({
		constructor: function() {
			// make sure this always means this
			bindAll(this);

			// keep a reference to the application
			this.application = arguments[0].application;

			// bind application events
			setApplicationBindings((this.applicationEvents || {}), this);

			// compile template
			compileTemplate(this);

			// call the parent constructor
			Backbone.View.prototype.constructor.apply(this, arguments);
		}
	});

	// add other methods
	_.extend(Minionette.View.prototype, {
		template: null,
		templateEl: null,
		beforeRemove: doNothing,
		remove: function() {
			return commonRemove(this);
		}
	});

	//////////////////////
	// MINIONETTE ITEMVIEW
	//////////////////////

	Minionette.ItemView = Backbone.View.extend({
		constructor: function() {
			var options = (arguments[0] || {});

			// make sure this always means this
			bindAll(this);

			// keep a reference to the application
			this.application = options.application;

			// bind application events
			setApplicationBindings((this.applicationEvents || {}), this);

			// if we have a collection, set it up
			if (this.collection) {
				this.setCollection(this.collection, _.defaults(
					(this.collectionEvents || {}), {
						"add": "render",
						"change": "render",
						"remove": "render",
						"reset": "render",
						"sort": "render"
					}), this.comparator);
			}

			// compile template
			compileTemplate(this);

			// call parent constructor
			Backbone.View.prototype.constructor.apply(this, arguments);

			// if we have a model, set up its events
			if (this.model) {
				this.setModel(this.model, _.defaults(
					(this.modelEvents || {}),
					(this.model.urlRoot ? {
						"change": "renderAndSave",
						"destroy": "removeTriggeredByDestroy"
					} : {
						"change": "render"
					})));
			}

			// set up visible, if any
			setVisible(this);
		}
	});

	// add other methods
	_.extend(Minionette.ItemView.prototype, {
		template: null,
		templateEl: null,
		setCollection: function(collection, events, comparator) {
			setCollection(collection, events, comparator, this);
		},
		setModel: function(model, events) {
			setModel(model, events, this);
		},
		beforeRender: function(data) {
			return data;
		},
		afterRender: doNothing,
		render: function() {
			// get data
			var data;
			if (this.collection) {
				data = { list: collectionToJSON(this.collection) };
			} else if (this.model) {
				data = JSON.parse(JSON.stringify(this.model.attributes));
			} else {
				data = null;
			}

			// run before render function
			data = this.beforeRender(data);

			// render template if data found
			if (data) {
				this.$el.html(this.template(data));
			}

			// toggle visibility
			toggleVisible(this);

			// run after render function
			this.afterRender();

			// allow chaining
			return this;
		},
		renderAndSave: function() {
			this.render();
			this.model.save(null, {
				success: this.ajaxSuccess,
				error: this.ajaxError
			});
			return this;
		},
		beforeRemove: doNothing,
		remove: function(triggeredByDestroy) {
			commonRemove(this);
			if (this.model &&
				!triggeredByDestroy &&
				this.model.urlRoot) {
				this.model.destroy({
					success: this.ajaxSuccess,
					error: this.ajaxError
				});
			}
			return this;
		},
		removeTriggeredByDestroy: function() {
			this.remove(true);
		},
		toJSON: function() {
			// start building result
			var result = {},
				key,
				value;

			// loop over attributes
			for (key in this.attributes) {
				if (this.attributes.hasOwnProperty(key)) {
					// get value for this attribute
					value = this.get(key);

					// if value is a Backbone.Collection, JSON encode it;
					// otherwise, use the value directly
					result[key] = ((value instanceof Backbone.Collection) ?
									value.toJSON() :
									value);
				}
			}

			// done; return result
			return result;
		}
	});

	//////////////////////
	// MINIONETTE LISTVIEW
	//////////////////////

	Minionette.ListView = Backbone.View.extend({
		constructor: function() {
			var options = (arguments[0] || {});

			// make sure this always means this
			bindAll(this);

			// keep a reference to the application
			this.application = options.application;

			// bind application events
			setApplicationBindings((this.applicationEvents || {}), this);

			// keep track of views
			this.views = new ViewManager();

			// set up collection
			this.setCollection((this.collection || Backbone.Collection), _.defaults(
				(this.collectionEvents || {}), {
					"add": "append",
					"reset": "render",
					"sort": "render"
				}), this.comparator);

			// compile template
			compileTemplate(this);

			// call parent constructor
			Backbone.View.prototype.constructor.apply(this, arguments);

			// set up visible, if any
			setVisible(this);
		}
	});

	// add other methods
	_.extend(Minionette.ListView.prototype, {
		itemView: Minionette.ItemView,
		template: null,
		templateEl: null,
		itemViewContainer: null,
		setCollection: function(collection, events, comparator) {
			setCollection(collection, events, comparator, this);
		},
		append: function(item, collection, options) {
			var view = new this.itemView({
				application: this.application,
				model: item
			});
			this.views.add(view);
			(this.$itemViewContainer || this.$el).append(view.render().$el);
		},
		beforeRender: _.identity,
		afterRender: doNothing,
		render: function() {
			// run before render function
			var data = this.beforeRender(this.model);

			// if we have a template...
			if (this.template) {
				// run template and append result
				this.$el.html(this.template(data));
			}

			// get item wrapper, if any
			if (this.itemViewContainer) {
				this.$itemViewContainer = this.$el.find(this.itemViewContainer);
			}

			// clear out previous views
			this.views.clear();

			// render collection
			this.collection.each(this.append);

			// toggle visibility
			toggleVisible(this);

			// run after render function
			this.afterRender();

			// allow chaining
			return this;
		},
		toJSON: function() {
			return collectionToJSON(this.collection);
		},
		load: function(userOptions) {
			this.collection.fetch(_.defaults(
				(userOptions || {}), {
					reset: true,
					success: this.ajaxSuccess,
					error: this.ajaxError
				}));
		},
		add: function(attributes, options) {
			var collection = this.collection,
				model = new collection.model(attributes, options);

			if (!collection.url) {
				collection.add(model);
				toggleVisible(this);
				return;
			}

			var that = this;
			model.save(null, {
				success: function() {
					collection.add(model);
					toggleVisible(that);
					if (that.success) {
						that.success.apply(that, slice.call(arguments));
					}
				},
				error: this.error
			});
		},
		reset: function(items) {
			this.collection.reset(items);
		},
		setComparator: function(comparator) {
			this.collection.comparator = comparator;
			this.collection.sort();
		},
		beforeRemove: doNothing,
		remove: function() {
			return commonRemove(this);
		}
	});

	////////////////////
	// UNDERSCORE ADDONS
	////////////////////

	var moneyRegExp = /^\$?((\d+|\d{1,3}(,\d{3})+)(\.\d{0,2})?|(\d+|\d{1,3}(,\d{3})+)?(\.\d{0,2}))$/;
	_.money = {
		validate: function(value) {
			return ("" + value).match(moneyRegExp);
		},
		format: function(amount) {
			var negative = (amount < 0.0);
			if (negative) {
				amount = -amount;
			}

			// split dollars and cents
			amount = ("" + amount).split(".");

			// set dollars to 0 if empty
			if (!amount[0].length) {
				amount[0] = "0";
			// and to comma-separated triplets if greater than 3 digits long
			} else if (amount[0].length > 3) {
				var amountStart = (amount[0].match(/^(\d{1,3})(\d{3})+$/))[1],
					amountEnd = amount[0].substring(amountStart.length);
				amount[0] = [amountStart].concat(amountEnd.match(/\d{3}/g)).join(",");
			}

			// set cents to 00 if empty
			if (("undefined" == typeof amount[1]) || !amount[1].length) {
				amount[1] = "00";
			// and right pad with zeros if less than 1 digit long
			} else if (amount[1].length < 2) {
				amount[1] += "0";
			// and make sure it doesn't go longer than 2 digits
			} else if (amount[1].length > 2) {
				amount[1] = amount[1].substring(0, 2);
			}

			// prepend $ sign and re-combine dollars and cents
			return ((negative ? "-$" : "$") + amount.join("."));
		},
		unformat: function(money) {
			// remove extraneous characters and parse as float
			return parseFloat(("" + money).replace("$", "").replace(/,/g, ""));
		}
	};
});