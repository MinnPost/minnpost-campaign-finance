

/**
 * Helpers to extend to an app.
 */
define('helpers', ['jquery', 'underscore', 'Backbone'],
  function($, _, Backbone) {

  return {
    /**
     * Formats number
     */
    formatNumber: function(num, decimals) {
      decimals = (_.isUndefined(decimals)) ? 2 : decimals;
      var rgx = (/(\d+)(\d{3})/);
      split = num.toFixed(decimals).toString().split('.');

      while (rgx.test(split[0])) {
        split[0] = split[0].replace(rgx, '$1' + ',' + '$2');
      }
      return (decimals) ? split[0] + '.' + split[1] : split[0];
    },

    /**
     * Formats number into currency
     */
    formatCurrency: function(num) {
      return '$' + this.formatNumber(num, 2);
    },

    /**
     * Formats percentage
     */
    formatPercent: function(num) {
      return this.formatNumber(num * 100, 1) + '%';
    },

    /**
     * Formats percent change
     */
    formatPercentChange: function(num) {
      return ((num > 0) ? '+' : '') + this.formatPercent(num);
    },

    /**
     * Converts string into a hash (very basically).
     */
    hash: function(str) {
      return Math.abs(_.reduce(str.split(''), function(a, b) {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0));
    },

    /**
     * Creates identifier for things like CSS classes.
     */
    identifier: function(str) {
      return str.toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-').replace(/[^\w-]+/g,'');
    },

    /**
     * Returns version of MSIE.
     */
    isMSIE: function() {
      var match = /(msie) ([\w.]+)/i.exec(navigator.userAgent);
      return match ? parseInt(match[2], 10) : false;
    },


    /**
     * Override Backbone's ajax call to use JSONP by default as well
     * as force a specific callback to ensure that server side
     * caching is effective.
     */
    BackboneAJAX: function() {
      var options = arguments;

      if (options[0].dataTypeForce !== true) {
        options[0].dataType = 'jsonp';
        options[0].jsonpCallback = 'mpServerSideCachingHelper' +
          _.hash(options[0].url);
      }
      return Backbone.$.ajax.apply(Backbone.$, options);
    },


    /**
     * Wrapper for a JSONP request
     */
    jsonpRequest: function() {
      var options = arguments[0];

      options.dataType = 'jsonp';
      options.jsonpCallback = 'mpServerSideCachingHelper' +
        _.hash(options.url);
      return $.ajax.apply($, [options]);
    },

    /**
     * Data source handling.  For development, we can call
     * the data directly from the JSON file, but for production
     * we want to proxy for JSONP.
     *
     * `name` should be relative path to dataset minus the .json
     *
     * Returns jQuery's defferred object.
     */
    getLocalData: function(name) {
      var thisApp = this;
      var proxyPrefix = this.options.jsonpProxy;
      var useJSONP = false;
      var defers = [];

      this.data = this.data || {};
      name = (_.isArray(name)) ? name : [ name ];

      // If the data path is not relative, then use JSONP
      if (this.options && this.options.dataPath.indexOf('http') === 0) {
        useJSONP = true;
      }

      // Go through each file and add to defers
      _.each(name, function(d) {
        var defer;
        if (_.isUndefined(thisApp.data[d])) {

          if (useJSONP) {
            defer = this.jsonpRequest({
              url: proxyPrefix + encodeURI(thisApp.options.dataPath + d + '.json')
            });
          }
          else {
            defer = $.getJSON(thisApp.options.dataPath + d + '.json');
          }

          $.when(defer).done(function(data) {
            thisApp.data[d] = data;
          });
          defers.push(defer);
        }
      });

      return $.when.apply($, defers);
    },

    /**
     * Get remote data.  Provides a wrapper around
     * getting a remote data source, to use a proxy
     * if needed, such as using a cache.
     */
    getRemoteData: function(options) {
      options.dataType = 'jsonp';

      if (this.options.remoteProxy) {
        options.url = options.url + '&callback=proxied_jqjsp';
        options.url = app.options.remoteProxy + encodeURIComponent(options.url);
        options.callback = 'proxied_jqjsp';
        options.cache = true;
      }

      return $.ajax(options);
    }
  };
});

/**
 * Models
 */
define('models', ['underscore', 'Backbone', 'helpers'],
  function(_, Backbone, helpers) {
  var models = {};

  // Override backbone's ajax request for use with JSONP
  // which is not preferred but we have to support
  // older browsers
  Backbone.ajax = helpers.BackboneAJAX;

  // Base model
  models.Base = Backbone.Model.extend({
    initialize: function(data, options) {
      // Attach options
      this.options = options || {};
      this.app = options.app;

      // Call this in other models
      //models.NEWModel.__super__.initialize.apply(this, arguments);
    }
  });

  // Candidate
  models.Candidate = models.Base.extend({
    initialize: function(data, options) {
      models.Candidate.__super__.initialize.apply(this, arguments);
    }
  });

  // Return what we have
  return models;
});

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


/**
 * Views
 *
 * Ractive classes can be extended but we still need a number of
 * things at instantian, like templates
 */
define('views', ['underscore', 'jquery', 'Ractive', 'Highcharts', 'helpers'],
  function(_, $, Ractive, Highcharts, helpers) {
  var views = {};
  var defaultChartOptions;

  // Base view to extend from
  views.Base = Ractive.extend({
    baseInit: function(options) {
      this.router = options.router;
    }
  });

  // View for application container
  views.Application = views.Base.extend({
    init: function() {
      this.baseInit.apply(this, arguments);
    }
  });

  // View for contests
  views.Contests = views.Base.extend({
    init: function() {
      this.baseInit.apply(this, arguments);

      // Look for contests to then make charts
      this.observe('contests', function(n, o) {
        var thisView = this;
        var options;

        if (!_.isUndefined(n)) {
          _.each(n, function(contest, ci) {
            // Make chart options and add data
            options = _.clone(defaultChartOptions);
            options = $.extend(true, options, {
              xAxis: {
                categories: contest.candidates.pluck('candidate')
              },
              series: [{
                name: 'Cash on hand',
                data: contest.candidates.pluck('cashonhand')
              },
              {
                name: 'Amount raised',
                data: contest.candidates.pluck('amountraised')
              }],
              tooltip: {
                formatter: function() {
                  return '<strong>' + this.key + '</strong> <br /> <br /> ' + this.series.name + ': <strong>' + helpers.formatCurrency(this.y) + '</strong>';
                }
              }
            });

            $(this.el).find('.chart-' + contest.id).highcharts(options);
          }, this);
        }
      });
    }
  });

  // Default chart options
  defaultChartOptions = {
    chart: {
      type: 'bar',
      style: {
        fontFamily: '"HelveticaNeue-Light", "Helvetica Neue Light", "Helvetica Neue", Helvetica, Arial, "Lucida Grande", sans-serif',
        color: '#BCBCBC'
      }
    },
    colors: ['#1D71A5', '#1DA595', '#1DA551'],
    credits: {
      enabled: false
    },
    title: {
      enabled: false,
      text: null
    },
    legend: {
      enabled: false,
      borderWidth: 0
    },
    plotOptions: {
      bar: {
        minPointLength: 3
      }
    },
    xAxis: {
      title: { },
      minPadding: 0,
      maxPadding: 0,
      type: 'category',
      labels: {
        formatter: function() {
          return this.value;
        }
      }
    },
    yAxis: {
      title: {
        enabled: false,
        text: 'US Dollars',
        margin: 5,
        style: {
          color: 'inherit',
          fontWeight: 'normal'
        }
      },
      min: 0,
      gridLineColor: '#BCBCBC'
    },
    tooltip: {
      //shadow: false,
      //borderRadius: 0,
      //borderWidth: 0,
      style: {},
      useHTML: true,
      formatter: function() {
        return this.key + ': <strong>' + this.y + '</strong>';
      }
    }
  };

  // Return what we have
  return views;
});

define('text!templates/application.mustache',[],function () { return '<div class="message-container"></div>\n\n<div class="content-container">\n\n\n</div>\n\n<div class="footnote-container">\n  <div class="footnote">\n    <p>Data from the <a href="http://www.fec.gov/" target="_blank">Federal Elections Committee</a> and the <a href="http://www.cfboard.state.mn.us/" target="_blank">Minnesota Campaign Finance and Public Disclosure Board</a>.  Some code, techniques, and data on <a href="https://github.com/zzolo/minnpost-campaign-finance" target="_blank">Github</a>.</p>\n  </div>\n</div>\n';});

define('text!templates/contests.mustache',[],function () { return '<div class="contests">\n\n  {{#contests}}\n    {{>contest}}\n  {{/contests}}\n\n</div>\n\n\n<!-- {{>contest}} -->\n<div class="contest {{ id }}">\n  <h4>{{ name }}</h4>\n\n  <div class="contest-chart chart-{{ id }}"></div>\n\n  <table>\n    <thead>\n      <tr>\n        <th></th>\n        <th>Candidate</th>\n        <th>Amount raised <span class="label-amount-raised"></span></th>\n        <th>Cash on hand <span class="label-cash-hand"></span></th>\n      </tr>\n    </thead>\n\n    <tbody>\n      {{#candidates}}\n        <tr>\n          <td><span class="party party-{{ party }}"></span></td>\n          <td>{{ candidate }}</td>\n          <td>\n            {{#(amountraised == 0)}}\n              <span class="no-data">(no data)</span>\n            {{/()}}\n            {{#(amountraised > 0)}}\n              {{ formatters.formatCurrency(amountraised) }}\n            {{/()}}\n          </td>\n          <td>{{ formatters.formatCurrency(cashonhand) }}</td>\n        </tr>\n      {{/candidates}}\n    </tbody>\n  </table>\n\n  <div class="time-span">\n    Data from {{ from.format(\'MMM Do, YYYY\') }} through {{ to.format(\'MMM Do, YYYY\') }}.\n  </div>\n\n</div>\n<!-- {{/contest}} -->\n';});

define('text!templates/loading.mustache',[],function () { return '<div class="loading-container">\n  <div class="loading"><span>Loading...</span></div>\n</div>';});

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

define('text!../data/campaign_finance_spreadsheet.json',[],function () { return '{"2014 Campaign Finances":[{"contest":"Governor","candidate":"Mark Dayton","incumbent":"Y","party":"D","amountraised":100000,"cashonhand":9999.38,"from":"","to":"","rowNumber":1},{"contest":"Governor","candidate":"Scott Honour","incumbent":"","party":"R","amountraised":999,"cashonhand":9,"from":"","to":"","rowNumber":2},{"contest":"Governor","candidate":"Kurt Zellers","incumbent":"","party":"R","amountraised":999,"cashonhand":9,"from":"","to":"","rowNumber":3},{"contest":"U.S. Senate","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":8619462.99,"cashonhand":3893286.11,"from":"7/1/2013","to":"9/30/2013","rowNumber":4},{"contest":"U.S. Senate","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":1468840.99,"cashonhand":1252087.2,"from":"7/1/2013","to":"9/30/2013","rowNumber":5},{"contest":"U.S. Senate","candidate":"Julianne Ortman","incumbent":"","party":"R","amountraised":119466,"cashonhand":88121.1,"from":"7/1/2013","to":"9/30/2013","rowNumber":6},{"contest":"U.S. Senate","candidate":"Jim Abeler","incumbent":"","party":"R","amountraised":54854,"cashonhand":34568.7,"from":"7/1/2013","to":"9/30/2013","rowNumber":7},{"contest":"U.S. Senate","candidate":"Chris Dahlberg","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","rowNumber":8},{"contest":"Conressional District 1","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":479508.7,"cashonhand":238512.29,"from":"7/1/2013","to":"9/30/2013","rowNumber":9},{"contest":"Conressional District 1","candidate":"Mike Benson","incumbent":"","party":"R","amountraised":28158.36,"cashonhand":14707.85,"from":"7/1/2013","to":"9/30/2013","rowNumber":10},{"contest":"Conressional District 1","candidate":"Jim Hagedorn","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","rowNumber":11},{"contest":"Conressional District 1","candidate":"Aaron Miller","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","rowNumber":12},{"contest":"Conressional District 2","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":1107528.4,"cashonhand":1307904.91,"from":"7/1/2013","to":"9/30/2013","rowNumber":13},{"contest":"Conressional District 2","candidate":"David Gerson","incumbent":"","party":"R","amountraised":5182,"cashonhand":2000.05,"from":"7/1/2013","to":"9/30/2013","rowNumber":14},{"contest":"Conressional District 2","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":204353.2,"cashonhand":119453.55,"from":"7/1/2013","to":"9/30/2013","rowNumber":15},{"contest":"Conressional District 2","candidate":"Paula Overby","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","rowNumber":16},{"contest":"Conressional District 2","candidate":"Thomas Craft","incumbent":"","party":"D","amountraised":22230.78,"cashonhand":13508.7,"from":"7/1/2013","to":"9/30/2013","rowNumber":17},{"contest":"Conressional District 3","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":1235371.01,"cashonhand":1526807.21,"from":"7/1/2013","to":"9/30/2013","rowNumber":18},{"contest":"Conressional District 4","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":261510.62,"cashonhand":89076.71,"from":"7/1/2013","to":"9/30/2013","rowNumber":19},{"contest":"Conressional District 5","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":719932.99,"cashonhand":186248.91,"from":"7/1/2013","to":"9/30/2013","rowNumber":20},{"contest":"Conressional District 6","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":373476.88,"cashonhand":274836.94,"from":"7/1/2013","to":"9/30/2013","rowNumber":21},{"contest":"Conressional District 6","candidate":"Phil Krinkie","incumbent":"","party":"R","amountraised":38243.01,"cashonhand":314880.29,"from":"7/1/2013","to":"9/30/2013","rowNumber":22},{"contest":"Conressional District 6","candidate":"Rhonda Sivarajah","incumbent":"","party":"R","amountraised":49128.31,"cashonhand":184332.22,"from":"7/1/2013","to":"9/30/2013","rowNumber":23},{"contest":"Conressional District 6","candidate":"Jim Read","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","rowNumber":24},{"contest":"Conressional District 7","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":363193.12,"cashonhand":227388.06,"from":"7/1/2013","to":"9/30/2013","rowNumber":25},{"contest":"Conressional District 7","candidate":"Torrey Westrom","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","rowNumber":26},{"contest":"Conressional District 8","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":418457.48,"cashonhand":261059.73,"from":"7/1/2013","to":"9/30/2013","rowNumber":27},{"contest":"Conressional District 8","candidate":"Stewart Mills","incumbent":"","party":"R","amountraised":243826.3,"cashonhand":234442.53,"from":"7/1/2013","to":"9/30/2013","rowNumber":28}]}';});

/**
 * Main application file for: minnpost-campaign-finance
 *
 * This pulls in all the parts
 * and creates the main object for the application.
 */
define('minnpost-campaign-finance', [
  'underscore', 'moment', 'helpers', 'routers', 'collections',
  'text!../data/campaign_finance_spreadsheet.json'
],
  function(_, moment, helpers, routers, collections, dCFS) {

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
      contest.from = moment(_.max(candidates, function(c, ci) {
        return moment(c.from).unix();
      }).from);
      contest.to = moment(_.max(candidates, function(c, ci) {
        return moment(c.to).unix();
      }).to);
      contest.candidates = new collections.Candidates(candidates, {
        app: this
      });
      this.contests.push(contest);
    }, this);
  };

  return App;
});
