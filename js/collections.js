/**
 * Collections
 */
define('collections', ['underscore', 'Backbone', 'helpers', 'models'],
  function(_, Backbone, helpers, models) {
  var collections = {};

  // Override backbone's ajax request for use with JSONP
  // which is not preferred but we have to support
  // older browsers
  Backbone.ajax = helpers.BackboneAJAX;

  // Base collection
  collections.Base = Backbone.Collection.extend({
    initialize: function(models, options) {
      // Attach options
      this.options = options || {};
      this.app = options.app;

      // Call this in other collections
      //collection.NEWCollection.__super__.initialize.apply(this, arguments);
    }
  });

  // Candidates
  collections.Candidates = collections.Base.extend({
    initialize: function() {
      collections.Candidates.__super__.initialize.apply(this, arguments);
    },

    comparator: function(model) {
      return model.get('amountraised') * -1;
    }
  });

  // Return what we have
  return collections;
});
