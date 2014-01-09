/**
 * Routers
 */
define('routers', [
  'underscore', 'Backbone', 'Ractive', 'Ractive-Backbone',
  'helpers', 'models', 'collections', 'views',
  'text!templates/application.mustache',
  'text!templates/contests.mustache',
  'text!templates/loading.mustache'
], function(_, Backbone, Ractive, RactiveBackbone,
    helpers, models, collections, views,
    tApplication, tContests, tLoading) {
  var routers = {};

  // Base model
  routers.Router = Backbone.Router.extend({
    views: {},

    initialize: function(options) {
      this.options = options;
      this.app = options.app;

      // Create application view
      this.views.application = new views.Application({
        el: this.app.$el,
        template: tApplication,
        data: {

        },
        router: this,
        partials: {
          loading: tLoading
        },
        adaptors: [ 'Backbone' ]
      });

      // Get content element
      this.$contentEl = this.app.$el.find('.content-container');
    },

    routes: {
      'contests': 'routeContests',
      '*default': 'routeDefault'
    },

    // Start router
    start: function() {
      Backbone.history.start();
    },

    // Default route
    routeDefault: function() {
      this.navigate('/contests', { trigger: true, replace: true });
    },

    // Overview of all contests
    routeContests: function() {
      this.views.contests = new views.Contests({
        el: this.$contentEl,
        template: tContests,
        data: {
          contests: this.app.contests,
          formatters: helpers
        },
        router: this,
        partials: {
          loading: tLoading
        },
        adaptors: [ 'Backbone' ]
      });
    }
  });

  // Return what we have
  return routers;
});
