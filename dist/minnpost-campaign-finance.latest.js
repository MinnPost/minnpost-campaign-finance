

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
      return str.toString().toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-').replace(/[^\w-]+/g,'');
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
define('views', ['underscore', 'jquery', 'Ractive', 'Ractive-events-tap', 'Highcharts', 'helpers'],
  function(_, $, Ractive, RTap, Highcharts, helpers) {
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

      // Handle interval update
      this.on('updateInterval', function(e) {
        e.original.preventDefault();
        var $link = $(e.node);
        var $links = $link.parent().find('a');
        var newID = $link.data('id');
        var kSplit = e.keypath.split('.');
        var contestPath = kSplit[0] + '.' + kSplit[1];
        var contest = this.get(contestPath);
        var currentInterval = _.find(contest.intervals, function(i, ii) {
          return i.id === newID.toString();
        });

        // Update current interval
        this.set(contestPath + '.currentInterval', currentInterval);

        // Scroll to
        this.scrollToContest(kSplit[1]);
      });

      // There is no way to use wildcards, so we look at the
      // the data that comes in and create observers on that so
      // that we only change what needs to be changed.
      // Also check if charts are disabled
      if (!this.router.app.options.disableCharts()) {
        _.each(this.data.contests, function(c, ci) {
          this.observe('contests.' + ci.toString(), function(n, o) {
            if (!_.isUndefined(n)) {
              this.updateChart(n);
            }
          });
        }, this);
      }
    },

    // Update chart for specific contest
    updateChart: function(contest) {
      // Create a wrapper for plucking
      var pluck = function(collection, property) {
        return _.map(collection, function(c, ci) {
          return c.get(property);
        });
      };

      // Only get the candidates in the current interval
      var candidates = contest.candidates.filter(function(c, ci) {
        return (c.get('interval') === contest.currentInterval.name);
      });

      // Make chart options and add data
      options = _.clone(defaultChartOptions);
      options = $.extend(true, options, {
        xAxis: {
          categories: pluck(candidates, 'candidate')
        },
        series: [{
          name: 'Cash on hand',
          data: pluck(candidates, 'cashonhand')
        },
        {
          name: 'Amount raised',
          data: pluck(candidates, 'amountraised')
        }]
      });

      var chart = $(this.el).find('.chart-' + contest.id).highcharts(options);
    },

    // Scroll to contest
    scrollToContest: function(id) {
      var contest = this.get('contests.' + id.toString());
      var top = $('.' + contest.id).offset().top;
      $('html, body').animate({ scrollTop: top - 15 }, 500, 'swing');
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
        return '<strong>' + this.key + '</strong> <br /> <br /> ' + this.series.name + ': <strong>' + helpers.formatCurrency(this.y) + '</strong>';
      }
    }
  };

  // Return what we have
  return views;
});

define('text!templates/application.mustache',[],function () { return '<div class="message-container"></div>\n\n<div class="content-container">\n\n\n</div>\n\n<div class="footnote-container">\n  <div class="footnote">\n    <p>Data from the <a href="http://www.fec.gov/" target="_blank">Federal Elections Committee</a> and the <a href="http://www.cfboard.state.mn.us/" target="_blank">Minnesota Campaign Finance and Public Disclosure Board</a>.  Some code, techniques, and data on <a href="https://github.com/MinnPost/minnpost-campaign-finance" target="_blank">Github</a>.</p>\n  </div>\n</div>\n';});

define('text!templates/contests.mustache',[],function () { return '<div class="contests">\n\n  {{#contests}}\n    {{>contest}}\n  {{/contests}}\n\n</div>\n\n\n<!-- {{>contest}} -->\n<div class="contest {{ id }}">\n  <h4>{{ name }}</h4>\n\n  <div class="intervals">\n    {{#intervals}}\n      <a href="#" data-id="{{ id }}" on-tap="updateInterval" class="{{#(id === currentInterval.id)}}active{{/()}}">{{ name }}</a>\n    {{/intervals}}\n  </div>\n\n  <div class="contest-chart chart-{{ id }}"></div>\n\n  <div class="responsive-table">\n    <table>\n      <thead>\n        <tr>\n          <th></th>\n          <th></th>\n          <th>Candidate</th>\n          <th>Total amount raised <span class="label-amount-raised"></span></th>\n          <th>Cash on hand <span class="label-cash-hand"></span></th>\n        </tr>\n      </thead>\n\n      <tbody>\n        {{#candidates}}\n          {{#(currentInterval.name === interval)}}\n            <tr>\n              <td>\n                <span class="party party-{{ party }}"></span>\n              </td>\n              <td>\n                {{#reporturl}}\n                  <a href="{{ reporturl }}" target="_blank" title="Report"><i class="fa fa-file-o"></i></a>\n                {{/reporturl}}\n              </td>\n              <td>\n                {{ candidate }}\n                {{#(incumbent === \'Y\')}}\n                  <span class="incumbent">(incumbent)</span>\n                {{/()}}\n              </td>\n              <td>\n                {{#(amountraised == 0)}}\n                  <span class="no-data">(no data)</span>\n                {{/()}}\n                {{#(amountraised > 0)}}\n                  {{ formatters.formatCurrency(amountraised) }}\n                {{/()}}\n              </td>\n              <td>{{ formatters.formatCurrency(cashonhand) }}</td>\n            </tr>\n          {{/()}}\n        {{/candidates}}\n      </tbody>\n    </table>\n  </div>\n\n  <div class="time-span">\n    Data from {{ currentInterval.from.format(\'MMM Do, YYYY\') }} through {{ currentInterval.to.format(\'MMM Do, YYYY\') }}.\n  </div>\n\n</div>\n<!-- {{/contest}} -->\n';});

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

define('text!../data/campaign_finance_spreadsheet.json',[],function () { return '{"2014 Campaign Finances":[{"contest":"Governor","interval":"Q1 2014","candidate":"Mark Dayton","incumbent":"Y","party":"D","amountraised":1282608.11,"cashonhand":733114.86,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":1},{"contest":"Governor","interval":"Q1 2014","candidate":"Scott Honour","incumbent":"","party":"R","amountraised":832755,"cashonhand":63693.73,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":2},{"contest":"Governor","interval":"Q1 2014","candidate":"Kurt Zellers","incumbent":"","party":"R","amountraised":494008.11,"cashonhand":79777.01,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":3},{"contest":"Governor","interval":"Q1 2014","candidate":"Jeff Johnson","incumbent":"","party":"R","amountraised":274716.73,"cashonhand":141710.77,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":4},{"contest":"Governor","interval":"Q1 2014","candidate":"Dave Thompson","incumbent":"","party":"R","amountraised":191537.72,"cashonhand":37695.72,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":5},{"contest":"Governor","interval":"Q1 2014","candidate":"Marty Seifert","incumbent":"","party":"R","amountraised":214279.05,"cashonhand":139082.95,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":6},{"contest":"Governor","interval":"Q1 2014","candidate":"Rob Farnsworth","incumbent":"","party":"R","amountraised":7855.01,"cashonhand":315.83,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":7},{"contest":"U.S. Senate","interval":"Q1 2014","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":15129502.21,"cashonhand":5933851.39,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":8},{"contest":"U.S. Senate","interval":"Q1 2014","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":2851538,"cashonhand":1791300.89,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":9},{"contest":"U.S. Senate","interval":"Q1 2014","candidate":"Chris Dahlberg","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":10},{"contest":"U.S. Senate","interval":"Q1 2014","candidate":"Julianne Ortman","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":11},{"contest":"U.S. Senate","interval":"Q1 2014","candidate":"Jim Abeler","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":12},{"contest":"Congressional District 1","interval":"Q1 2014","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":827830.23,"cashonhand":411216.6,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":13},{"contest":"Congressional District 1","interval":"Q1 2014","candidate":"Mike Benson","incumbent":"","party":"R","amountraised":77526.73,"cashonhand":6444.1,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":14},{"contest":"Congressional District 1","interval":"Q1 2014","candidate":"Jim Hagedorn","incumbent":"","party":"R","amountraised":33470,"cashonhand":4350.44,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":15},{"contest":"Congressional District 1","interval":"Q1 2014","candidate":"Aaron Miller","incumbent":"","party":"R","amountraised":32007.5,"cashonhand":43164.48,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":16},{"contest":"Congressional District 2","interval":"Q1 2014","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":1828844.32,"cashonhand":1658175.61,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":17},{"contest":"Congressional District 2","interval":"Q1 2014","candidate":"David Gerson","incumbent":"","party":"R","amountraised":15812.34,"cashonhand":6642.99,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":18},{"contest":"Congressional District 2","interval":"Q1 2014","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":417918.62,"cashonhand":238211.02,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":19},{"contest":"Congressional District 2","interval":"Q1 2014","candidate":"Thomas Craft","incumbent":"","party":"D","amountraised":22676.92,"cashonhand":2965.89,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":20},{"contest":"Congressional District 2","interval":"Q1 2014","candidate":"Paula Overby","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":21},{"contest":"Congressional District 3","interval":"Q1 2014","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":1973339.47,"cashonhand":1979136.02,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":22},{"contest":"Congressional District 3","interval":"Q1 2014","candidate":"Sharon Sund","incumbent":"","party":"D","amountraised":33577.66,"cashonhand":28834.98,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":23},{"contest":"Congressional District 4","interval":"Q1 2014","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":499304.62,"cashonhand":214079.21,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":24},{"contest":"Congressional District 5","interval":"Q1 2014","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":1197323.82,"cashonhand":229460.28,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":25},{"contest":"Congressional District 6","interval":"Q1 2014","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":833203.94,"cashonhand":252737.63,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":26},{"contest":"Congressional District 6","interval":"Q1 2014","candidate":"Phil Krinkie","incumbent":"","party":"R","amountraised":69370.57,"cashonhand":315743.68,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":27},{"contest":"Congressional District 6","interval":"Q1 2014","candidate":"Rhonda Sivarajah","incumbent":"","party":"R","amountraised":65147.02,"cashonhand":214808.37,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":28},{"contest":"Congressional District 6","interval":"Q1 2014","candidate":"Jim Read","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":29},{"contest":"Congressional District 6","interval":"Q1 2014","candidate":"Joe Perske","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":30},{"contest":"Congressional District 6","interval":"Q1 2014","candidate":"Judy Adams","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":31},{"contest":"Congressional District 7","interval":"Q1 2014","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":745742.43,"cashonhand":522650.49,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":32},{"contest":"Congressional District 7","interval":"Q1 2014","candidate":"Torrey Westrom","incumbent":"","party":"R","amountraised":204458.69,"cashonhand":170728.95,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":33},{"contest":"Congressional District 8","interval":"Q1 2014","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":813938.31,"cashonhand":478215.97,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":34},{"contest":"Congressional District 8","interval":"Q1 2014","candidate":"Stewart Mills","incumbent":"","party":"R","amountraised":650830.83,"cashonhand":355738.89,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":35},{"contest":"Governor","interval":2013,"candidate":"Mark Dayton","incumbent":"Y","party":"D","amountraised":1086739.75,"cashonhand":772062.18,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":36},{"contest":"Governor","interval":2013,"candidate":"Scott Honour","incumbent":"","party":"R","amountraised":596680,"cashonhand":14251.94,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":37},{"contest":"Governor","interval":2013,"candidate":"Kurt Zellers","incumbent":"","party":"R","amountraised":402600.97,"cashonhand":115864.07,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":38},{"contest":"Governor","interval":2013,"candidate":"Jeff Johnson","incumbent":"","party":"R","amountraised":242689.73,"cashonhand":168874.85,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":39},{"contest":"Governor","interval":2013,"candidate":"Dave Thompson","incumbent":"","party":"R","amountraised":124648.72,"cashonhand":50283.48,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":40},{"contest":"Governor","interval":2013,"candidate":"Marty Seifert","incumbent":"","party":"R","amountraised":150151.83,"cashonhand":138474.7,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":41},{"contest":"Governor","interval":2013,"candidate":"Rob Farnsworth","incumbent":"","party":"R","amountraised":4020,"cashonhand":1636.36,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":42},{"contest":"U.S. Senate","interval":"Q4 2013","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":12407312.94,"cashonhand":4839250.22,"from":"10/1/2013","to":"12/31/2013","reporturl":"","rowNumber":43},{"contest":"U.S. Senate","interval":"Q4 2013","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":2248296.44,"cashonhand":1684803.26,"from":"10/1/2013","to":"12/31/2013","reporturl":"","rowNumber":44},{"contest":"U.S. Senate","interval":"Q4 2013","candidate":"Chris Dahlberg","incumbent":"","party":"R","amountraised":103048,"cashonhand":46967.33,"from":"10/1/2013","to":"12/31/2013","reporturl":"","rowNumber":45},{"contest":"U.S. Senate","interval":"Q4 2013","candidate":"Julianne Ortman","incumbent":"","party":"R","amountraised":234429.63,"cashonhand":114119.11,"from":"10/1/2013","to":"12/31/2013","reporturl":"","rowNumber":46},{"contest":"U.S. Senate","interval":"Q4 2013","candidate":"Jim Abeler","incumbent":"","party":"R","amountraised":81580,"cashonhand":24806.45,"from":"10/1/2013","to":"12/31/2013","reporturl":"","rowNumber":47},{"contest":"Congressional District 1","interval":"Q4 2013","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":637347.19,"cashonhand":293490.85,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00409409/905770/","rowNumber":48},{"contest":"Congressional District 1","interval":"Q4 2013","candidate":"Mike Benson","incumbent":"","party":"R","amountraised":60447.73,"cashonhand":28966.2,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00546945/903598/","rowNumber":49},{"contest":"Congressional District 1","interval":"Q4 2013","candidate":"Jim Hagedorn","incumbent":"","party":"R","amountraised":36590,"cashonhand":15998.15,"from":"1/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00550707/904155/","rowNumber":50},{"contest":"Congressional District 1","interval":"Q4 2013","candidate":"Aaron Miller","incumbent":"","party":"R","amountraised":24457,"cashonhand":40994.03,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00548693/903302/","rowNumber":51},{"contest":"Congressional District 2","interval":"Q4 2013","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":1558216.98,"cashonhand":1620031.68,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00326629/904336/","rowNumber":52},{"contest":"Congressional District 2","interval":"Q4 2013","candidate":"David Gerson","incumbent":"","party":"R","amountraised":13569.03,"cashonhand":3896.07,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00523738/906556/","rowNumber":53},{"contest":"Congressional District 2","interval":"Q4 2013","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":336839.54,"cashonhand":203510.59,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00518811/905229/","rowNumber":54},{"contest":"Congressional District 2","interval":"Q4 2013","candidate":"Thomas Craft","incumbent":"","party":"D","amountraised":22676.92,"cashonhand":8978.66,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00546465/903334/","rowNumber":55},{"contest":"Congressional District 2","interval":"Q4 2013","candidate":"Paula Overby","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":56},{"contest":"Congressional District 3","interval":"Q4 2013","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":1528650.98,"cashonhand":1701994.5,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00439661/905245/","rowNumber":57},{"contest":"Congressional District 4","interval":"Q4 2013","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":354652.62,"cashonhand":124088.88,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00354688/904337/","rowNumber":58},{"contest":"Congressional District 5","interval":"Q4 2013","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":909374.2,"cashonhand":163624.66,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00422410/904772/","rowNumber":59},{"contest":"Congressional District 6","interval":"Q4 2013","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":626299.61,"cashonhand":335725.73,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00545749/904786/","rowNumber":60},{"contest":"Congressional District 6","interval":"Q4 2013","candidate":"Phil Krinkie","incumbent":"","party":"R","amountraised":57328.15,"cashonhand":290916.12,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00547786/906234/","rowNumber":61},{"contest":"Congressional District 6","interval":"Q4 2013","candidate":"Rhonda Sivarajah","incumbent":"","party":"R","amountraised":62407.02,"cashonhand":192505.47,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00546283/902822/","rowNumber":62},{"contest":"Congressional District 6","interval":"Q4 2013","candidate":"Jim Read","incumbent":"","party":"D","amountraised":33778,"cashonhand":24134.19,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00551010/903997/","rowNumber":63},{"contest":"Congressional District 6","interval":"Q4 2013","candidate":"Joe Perske","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":64},{"contest":"Congressional District 6","interval":"Q4 2013","candidate":"Judy Adams","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":65},{"contest":"Congressional District 7","interval":"Q4 2013","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":527827.63,"cashonhand":357686.97,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00253187/904159/","rowNumber":66},{"contest":"Congressional District 7","interval":"Q4 2013","candidate":"Torrey Westrom","incumbent":"","party":"R","amountraised":84346.63,"cashonhand":83677.6,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00554352/904407/","rowNumber":67},{"contest":"Congressional District 8","interval":"Q4 2013","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":562855.21,"cashonhand":298061.72,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00499053/905763/","rowNumber":68},{"contest":"Congressional District 8","interval":"Q4 2013","candidate":"Stewart Mills","incumbent":"","party":"R","amountraised":448390.28,"cashonhand":306289.75,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00546739/905793/","rowNumber":69},{"contest":"U.S. Senate","interval":"Q1 2013","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":5112997.21,"cashonhand":2034843.19,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/024/13020432024/13020432024.pdf","rowNumber":70},{"contest":"Congressional District 1","interval":"Q1 2013","candidate":"Tim Walz","incumbent":"","party":"D","amountraised":102298.16,"cashonhand":86395.55,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/787/13961644787/13961644787.pdf","rowNumber":71},{"contest":"Congressional District 2","interval":"Q1 2013","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":257833.14,"cashonhand":750130.39,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/335/13961254335/13961254335.pdf","rowNumber":72},{"contest":"Congressional District 2","interval":"Q1 2013","candidate":"David Gerson","incumbent":"","party":"R","amountraised":425,"cashonhand":4920.91,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/140/13963178140/13963178140.pdf","rowNumber":73},{"contest":"Congressional District 2","interval":"Q1 2013","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":1560,"cashonhand":5514.7,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/029/13961610029/13961610029.pdf","rowNumber":74},{"contest":"Congressional District 3","interval":"Q1 2013","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":362943.13,"cashonhand":943158.45,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/437/13964077437/13964077437.pdf","rowNumber":75},{"contest":"Congressional District 4","interval":"Q1 2013","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":103375,"cashonhand":62842.08,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/160/13940549160/13940549160.pdf","rowNumber":76},{"contest":"Congressional District 5","interval":"Q1 2013","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":220583.63,"cashonhand":86688.78,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/308/13961609308/13961609308.pdf","rowNumber":77},{"contest":"Congressional District 7","interval":"Q1 2013","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":187230.62,"cashonhand":160065.97,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/081/13961279081/13961279081.pdf","rowNumber":78},{"contest":"Congressional District 7","interval":"Q1 2013","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":154220.88,"cashonhand":118938.46,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/045/13962134045/13962134045.pdf","rowNumber":79},{"contest":"U.S. Senate","interval":"Q2 2013","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":6772007.69,"cashonhand":3005162.28,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/001/13020440001/13020440001.pdf","rowNumber":80},{"contest":"U.S. Senate","interval":"Q2 2013","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":763823.4,"cashonhand":741446.62,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/257/13020350257/13020350257.pdf","rowNumber":81},{"contest":"Congressional District 1","interval":"Q2 2013","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":302860.18,"cashonhand":173877.67,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/970/13964071970/13964071970.pdf","rowNumber":82},{"contest":"Congressional District 2","interval":"Q2 2013","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":740436.12,"cashonhand":1105914.77,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/837/13941279837/13941279837.pdf","rowNumber":83},{"contest":"Congressional District 2","interval":"Q2 2013","candidate":"David Gerson","incumbent":"","party":"R","amountraised":3097,"cashonhand":5700.48,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/896/14960019896/14960019896.pdf","rowNumber":84},{"contest":"Congressional District 2","interval":"Q2 2013","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":131620.21,"cashonhand":93161.38,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/534/13964059534/13964059534.pdf","rowNumber":85},{"contest":"Congressional District 3","interval":"Q2 2013","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":859255.67,"cashonhand":1296984.71,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/431/14940086431/14940086431.pdf","rowNumber":86},{"contest":"Congressional District 4","interval":"Q2 2013","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":162291,"cashonhand":58057.01,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/041/13964082041/13964082041.pdf","rowNumber":87},{"contest":"Congressional District 5","interval":"Q2 2013","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":410674.03,"cashonhand":140032.27,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/300/13964078300/13964078300.pdf","rowNumber":88},{"contest":"Congressional District 6","interval":"Q2 2013","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":220946.4,"cashonhand":198910.76,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/132/13941766132/13941766132.pdf","rowNumber":89},{"contest":"Congressional District 6","interval":"Q2 2013","candidate":"Rhonda Sivarajah","incumbent":"","party":"R","amountraised":19066,"cashonhand":15967.04,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/656/13941148656/13941148656.pdf","rowNumber":90},{"contest":"Congressional District 7","interval":"Q2 2013","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":281000.62,"cashonhand":205097.9,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/324/13964054324/13964054324.pdf","rowNumber":91},{"contest":"Congressional District 8","interval":"Q2 2013","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":288985.22,"cashonhand":194576.03,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/179/13964086179/13964086179.pdf","rowNumber":92},{"contest":"U.S. Senate","interval":"Q3 2013","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":8619462.99,"cashonhand":3893286.11,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/927/13020441927/13020441927.pdf","rowNumber":93},{"contest":"U.S. Senate","interval":"Q3 2013","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":1468840.99,"cashonhand":1252087.2,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/966/13020511966/13020511966.pdf","rowNumber":94},{"contest":"U.S. Senate","interval":"Q3 2013","candidate":"Julianne Ortman","incumbent":"","party":"R","amountraised":119466,"cashonhand":88121.1,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/664/13020491664/13020491664.pdf","rowNumber":95},{"contest":"U.S. Senate","interval":"Q3 2013","candidate":"Jim Abeler","incumbent":"","party":"R","amountraised":54854,"cashonhand":34568.7,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/789/13020491789/13020491789.pdf","rowNumber":96},{"contest":"U.S. Senate","interval":"Q3 2013","candidate":"Chris Dahlberg","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":97},{"contest":"Congressional District 1","interval":"Q3 2013","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":479508.7,"cashonhand":238512.29,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/703/13941800703/13941800703.pdf","rowNumber":98},{"contest":"Congressional District 1","interval":"Q3 2013","candidate":"Mike Benson","incumbent":"","party":"R","amountraised":28158.36,"cashonhand":14707.85,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/941/13964697941/13964697941.pdf","rowNumber":99},{"contest":"Congressional District 1","interval":"Q3 2013","candidate":"Jim Hagedorn","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":100},{"contest":"Congressional District 1","interval":"Q3 2013","candidate":"Aaron Miller","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":101},{"contest":"Congressional District 2","interval":"Q3 2013","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":1107528.4,"cashonhand":1307904.91,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/813/13941783813/13941783813.pdf","rowNumber":102},{"contest":"Congressional District 2","interval":"Q3 2013","candidate":"David Gerson","incumbent":"","party":"R","amountraised":5182,"cashonhand":2000.05,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/041/14960020041/14960020041.pdf","rowNumber":103},{"contest":"Congressional District 2","interval":"Q3 2013","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":204353.2,"cashonhand":119453.55,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/871/13941821871/13941821871.pdf","rowNumber":104},{"contest":"Congressional District 2","interval":"Q3 2013","candidate":"Paula Overby","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":105},{"contest":"Congressional District 2","interval":"Q3 2013","candidate":"Thomas Craft","incumbent":"","party":"D","amountraised":22230.78,"cashonhand":13508.7,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/279/13941844279/13941844279.pdf","rowNumber":106},{"contest":"Congressional District 3","interval":"Q3 2013","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":1235371.01,"cashonhand":1526807.21,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/598/14940086598/14940086598.pdf","rowNumber":107},{"contest":"Congressional District 4","interval":"Q3 2013","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":261510.62,"cashonhand":89076.71,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/090/13964683090/13964683090.pdf","rowNumber":108},{"contest":"Congressional District 5","interval":"Q3 2013","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":719932.99,"cashonhand":186248.91,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/974/13941799974/13941799974.pdf","rowNumber":109},{"contest":"Congressional District 6","interval":"Q3 2013","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":379216.9,"cashonhand":280431.33,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00545749/903848/","rowNumber":110},{"contest":"Congressional District 6","interval":"Q3 2013","candidate":"Phil Krinkie","incumbent":"","party":"R","amountraised":38243.01,"cashonhand":314880.29,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/298/14940037298/14940037298.pdf","rowNumber":111},{"contest":"Congressional District 6","interval":"Q3 2013","candidate":"Rhonda Sivarajah","incumbent":"","party":"R","amountraised":49128.31,"cashonhand":184332.22,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/953/13964790953/13964790953.pdf","rowNumber":112},{"contest":"Congressional District 6","interval":"Q3 2013","candidate":"Jim Read","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":113},{"contest":"Congressional District 7","interval":"Q3 2013","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":363193.12,"cashonhand":227388.06,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/893/13964634893/13964634893.pdf","rowNumber":114},{"contest":"Congressional District 7","interval":"Q3 2013","candidate":"Torrey Westrom","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":115},{"contest":"Congressional District 8","interval":"Q3 2013","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":418457.48,"cashonhand":261059.73,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/692/13941827692/13941827692.pdf","rowNumber":116},{"contest":"Congressional District 8","interval":"Q3 2013","candidate":"Stewart Mills","incumbent":"","party":"R","amountraised":243826.3,"cashonhand":234442.53,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/410/13964790410/13964790410.pdf","rowNumber":117}]}';});

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
