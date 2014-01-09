/**
 * Main application file for: minnpost-campaign-finance
 *
 * This pulls in all the parts
 * and creates the main object for the application.
 */
define('minnpost-campaign-finance', [
  'underscore', 'helpers', 'routers', 'collections',
  'text!../data/campaign_finance_spreadsheet.json'
],
  function(_, helpers, routers, collections, dCFS) {

  // Constructor for app
  var App = function(options) {
    this.options = options;
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
    var sheet = '2014 Campaign Finances';
    data = data[sheet];
    data = _.groupBy(data, 'contest');

    // Make collections of candidates for each contest
    this.contests = [];
    _.each(data, function(candidates, ci) {
      var contest = {};
      contest.name = ci;
      contest.id = this.identifier(ci);
      contest.candidates = new collections.Candidates(candidates, {
        app: this
      });
      this.contests.push(contest);
    }, this);
  };

  return App;
});
