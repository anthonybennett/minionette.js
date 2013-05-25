// Minionette.js 0.1.0
// (c) 2013 Anthony Bennett/
// Released under LGPL v3 (see license.txt)
(function(root, Backbone) {
	// standard boilerplate stuff
	var previousMinionette = root.Minionette,
		Minionette,
		slice = [].slice,
		collectionToJSON;

	if ("undefined" == typeof exports) {
		Minionette = root.Minionette = {};
	} else {
		Minionette = exports;
	}

	Minionette.VERSION = "0.1";

	Minionette.noConflict = function() {
		root.Minionette = previousMinionette;
		return this;
	};

	Backbone.emulateHTTP = true;

	/////////////////////////
	// MINIONETTE.APPLICATION
	/////////////////////////

	Minionette.Application = function(userOptions) {
		// keep an internal reference to this;
		// set up options
		var application = this,
			options = _.extend({
				views: application.views,
				links: application.links
			}, (userOptions || {}));

		// make sure this always means this
		_.bindAll(application);

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
			application.views.push(view);
		});

		// initialize the application itself
		application.initialize.apply(application, _.values(options));
	};

	// add an extend method
	Minionette.Application.extend = Backbone.Model.extend;

	// add other methods
	_.extend(Minionette.Application.prototype, {
		views: [],
		links: [],
		initialize: function() {},
		// this is the event bus, which is
		// borrows heavily from radio.js
		events: {},
		bind: function(name, callback) {
			if ("undefined" == typeof this.events[name]) {
				this.events[name] = [];
			}

			this.events[name].push(callback);
		},
		unbind: function(name, callback) {
			var event,
				i;

			if ("undefined" == typeof this.events[name]) {
				return;
			}

			event = this.events[name];
			i = _.indexOf(event, callback);
			if (i > -1) {
				event.splice(i, 1);
			}
		},
		trigger: function(name) {
			var event,
				args,
				i,
				l;

			if ("undefined" == typeof this.events[name]) {
				return;
			}

			event = this.events[name];
			args = slice.call(arguments, 1);
			for (i = 0, l = event.length; i < l; ++i) {
				event[i].apply(null, args);
			}
		}
	});

	/////////////////////
	// COLLECTION TO JSON
	/////////////////////

	collectionToJSON = function(collection) {
		// start building result
		var result = [];

		// loop over collection
		collection.each(function(item) {
			result.push(item.toJSON());
		});

		// done; return result
		return result;
	};

	//////////////////
	// MINIONETTE VIEW
	//////////////////

	Minionette.View = Backbone.View.extend({
		constructor: function() {
			// make sure this always means this
			_.bindAll(this);

			// keep a reference to the application
			this.application = arguments[0].application;

			// call the parent constructor
			Backbone.View.prototype.constructor.apply(this, arguments);
		}
	});

	//////////////////////
	// MINIONETTE ITEMVIEW
	//////////////////////

	Minionette.ItemView = Backbone.View.extend({
		constructor: function() {
			// make sure this always means this
			_.bindAll(this);

			// keep a reference to the application
			this.application = arguments[0].application;

			// if we have a collection, set it up
			if (this.collection) {
				this.setCollection(this.collection);
			}

			// call parent constructor
			Backbone.View.prototype.constructor.apply(this, arguments);

			// if we have a model, set up its events
			if (this.model) {
				this.setModel(this.model);
			}
		}
	});

	// add other methods
	_.extend(Minionette.ItemView.prototype, {
		template: null,
		setCollection: function(collection) {
			// clear previous events and reset it
			if ("object" == typeof this.collection) {
				this.stopListening(this.collection);
				this.collection.reset();
			}
			// set collection to incoming
			this.collection = collection;
			// initialize as needed
			if ("function" == typeof this.collection) {
				this.collection = new this.collection();
			}

			// set events
			this.listenTo(this.collection, "add", this.render);
			this.listenTo(this.collection, "change", this.render);
			this.listenTo(this.collection, "remove", this.render);
			this.listenTo(this.collection, "reset", this.render);
		},
		setModel: function(model) {
			// clear previous events
			this.stopListening(this.model);
			// set model to incoing
			this.model = model;
			// set events
			this.listenTo(this.model, "change", this.renderAndSave);
			this.listenTo(this.model, "destroy", this.removeTriggeredByDestroy);
		},
		render: function() {
			var data;

			// compile template
			if ("function" != typeof this.template) {
				this.template = _.template($(this.template).html());
			}

			// run template and append result
			if (this.collection) {
				data = { list: collectionToJSON(this.collection) };
			} else if (this.model) {
				data = this.model.attributes;
			} else {
				data = null;
			}
			if (data) {
				this.$el.html(this.template(data));
			}

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
		remove: function(triggeredByDestroy) {
			this.$el.remove();
			this.stopListening();
			if (this.collection) {
				this.collection = null;
			} else if (this.model) {
				if (!triggeredByDestroy) {
					this.model.destroy({
						success: this.ajaxSuccess,
						error: this.ajaxError
					});
				}
				this.model = null;
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
			// make sure this always means this
			_.bindAll(this);

			// keep a reference to the application
			this.application = arguments[0].application;

			// set up collection
			if ("function" == typeof this.collection) {
				this.collection = new this.collection();
			}

			// set up collection events
			this.listenTo(this.collection, "add", this.append);
			this.listenTo(this.collection, "reset", this.render);

			// call parent constructor
			Backbone.View.prototype.constructor.apply(this, arguments);
		}
	});

	// add other methods
	_.extend(Minionette.ListView.prototype, {
		itemView: Minionette.ItemView,
		template: null,
		elementSelector: null,
		append: function(item, collection, options) {
			var view = new this.itemView({
				application: this.application,
				model: item
			});
			this.$elementSelector.append(view.render().$el);
		},
		render: function() {
			var $elementSelector;

			// if we have a template...
			if (this.template) {
				// compile template
				if ("function" != typeof this.template) {
					this.template = _.template($(this.template).html());
				}

				// run template and append result
				this.$el.html(this.template(this.model));

				// get item wrapper
				this.$elementSelector = this.$el.find(this.elementSelector);
			} else {
				// item wrapper is just an alias to element
				this.$elementSelector = this.$el;
			}

			// render collection
			this.collection.each(this.append);

			// allow chaining
			return this;
		},
		toJSON: function() {
			return collectionToJSON(this.collection);
		},
		load: function(userOptions) {
			var options = _.extend({
				reset: true,
				success: this.ajaxSuccess,
				error: this.ajaxError
			}, (userOptions || {}));
			this.collection.fetch(options);
		},
		add: function(attributes, options) {
			var collection = this.collection,
				model = new collection.model(attributes, options),
				success = this.ajaxSuccess,
				error = this.ajaxError;

			model.save(null, {
				success: function() {
					collection.add(model);
					if (success) {
						success.apply(null, slice.call(arguments));
					}
				},
				error: error
			});
		}
	});
}(this, Backbone));