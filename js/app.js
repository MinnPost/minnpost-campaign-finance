/**
 * Main application file for: minnpost-campaign-finance
 *
 * This pulls in all the parts
 * and creates the main object for the application.
 */
define('minnpost-campaign-finance', [
  'jquery', 'underscore', 'Backbone', 'Highcharts', 'moment', 'helpers', 'routers', 'collections',
  'text!../data/campaign_finance_spreadsheet.json'
],
  function($, _, Backbone, Highcharts, moment, helpers, routers, collections, dCFS) {

  // Constructor for app
  var App = function(options) {
    this.options = _.extend({}, this.defaultOptions, options);
    this.el = this.options.el;
    if (this.el) {
      this.$el = $(this.el);
    }
  };

  // Extend with helpers
  _.extend(App.prototype, helpers);

  // Start function
  App.prototype.start = function() {
    // Get data and process into models
    this.loadData();

    // Create router
    this.router = new routers.Router({
      app: this
    });

    // Start backbone history
    this.router.start();
  };

  // Load up the data
  App.prototype.loadData = function() {
    var data = JSON.parse(dCFS);

    // Getting to the data will change based on how things are published.
    // Currently, only the sheet we want is published.
    var title = '2014 Campaign Finances';
    var sheet = null; // 'Campaign Finances';

    if (!_.isUndefined(data[title])) {
      data = data[title];
    }
    else {
      return;
    }
    data = _.groupBy(data, 'contest');

    // Make collections of candidates for each contest
    this.contests = [];
    _.each(data, function(candidates, ci) {
      var contest = {};

      // Top level values
      contest.name = ci;
      contest.id = this.identifier(ci);

      // Get intervals.
      contest.intervals = {};
      _.each(candidates, function(c, ci) {
        if (c.from && c.to) {
          contest.intervals[this.identifier(c.interval)] = {
            id: this.identifier(c.interval),
            name: c.interval,
            from: moment(c.from),
            to: moment(c.to)
          };
        }
      }, this);
      contest.intervals = _.sortBy(contest.intervals, function(i, ii) {
        return i.to.unix() * -1;
      });
      contest.currentInterval = contest.intervals[0];

      // Create candidate collections
      contest.candidates = new collections.Candidates(candidates, {
        app: this
      });
      this.contests.push(contest);
    }, this);
  };

  // Default options
  App.prototype.defaultOptions = {
    // Because of Impaq.me and their use of respond.js, the Highcharts
    // don't work out.
    disableCharts: function() {
      return (!_.isUndefined(window.impaq) && _.isObject(impaq) && helpers.isMSIE() === 8);
    }
  };

  return App;
});
