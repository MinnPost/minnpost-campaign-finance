
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


define('text!../data/campaign_finance_spreadsheet.json',[],function () { return '{"2014 Campaign Finances":[{"contest":"Governor","interval":"Year-end","candidate":"Mark Dayton","incumbent":"Y","party":"D","amountraised":3370625.57,"cashonhand":35184.53,"from":"1/1/2014","to":"12/31/2014","reporturl":"","rowNumber":1},{"contest":"Governor","interval":"Year-end","candidate":"Jeff Johnson","incumbent":"","party":"R","amountraised":2466177.47,"cashonhand":12310.9,"from":"1/1/2014","to":"12/31/2014","reporturl":"","rowNumber":2},{"contest":"U.S. Senate","interval":"Post-general","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":24526881.98,"cashonhand":523967.6,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/pdf/025/14021384025/14021384025.pdf","rowNumber":3},{"contest":"U.S. Senate","interval":"Post-general","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":6954142.67,"cashonhand":62003.93,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/pdf/249/14021421249/14021421249.pdf","rowNumber":4},{"contest":"Congressional District 1","interval":"Post-general","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":1544922.2,"cashonhand":154307.51,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00409409/978939/","rowNumber":5},{"contest":"Congressional District 1","interval":"Post-general","candidate":"Jim Hagedorn","incumbent":"","party":"R","amountraised":209660.37,"cashonhand":2720.63,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00550707/979677/","rowNumber":6},{"contest":"Congressional District 2","interval":"Post-general","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":2740539.67,"cashonhand":174327.79,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00326629/978504/","rowNumber":7},{"contest":"Congressional District 2","interval":"Post-general","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":928898.41,"cashonhand":12834.46,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00518811/977782/","rowNumber":8},{"contest":"Congressional District 2","interval":"Post-general","candidate":"Paula Overby","incumbent":"","party":"I","amountraised":797.5,"cashonhand":281.08,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00548727/976989/","rowNumber":9},{"contest":"Congressional District 3","interval":"Post-general","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":3185492.56,"cashonhand":1298888,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00439661/977245/","rowNumber":10},{"contest":"Congressional District 3","interval":"Post-general","candidate":"Sharon Sund","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"10/16/2014","to":"11/24/2014","reporturl":"","rowNumber":11},{"contest":"Congressional District 4","interval":"Post-general","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":861693.39,"cashonhand":204923.05,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00354688/977738/","rowNumber":12},{"contest":"Congressional District 4","interval":"Post-general","candidate":"Sharna Wahlgren","incumbent":"","party":"R","amountraised":68724.5,"cashonhand":1555.77,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00562207/980017/","rowNumber":13},{"contest":"Congressional District 5","interval":"Post-general","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":2092181.21,"cashonhand":193929.13,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00422410/979079/","rowNumber":14},{"contest":"Congressional District 5","interval":"Post-general","candidate":"Doug Daggett","incumbent":"","party":"R","amountraised":41564.5,"cashonhand":5305.89,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00563205/982920/","rowNumber":15},{"contest":"Congressional District 6","interval":"Post-general","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":1944189.67,"cashonhand":14221.46,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00545749/981190/","rowNumber":16},{"contest":"Congressional District 6","interval":"Post-general","candidate":"Joe Perske","incumbent":"","party":"D","amountraised":213413.2,"cashonhand":782.65,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00555029/974254/","rowNumber":17},{"contest":"Congressional District 6","interval":"Post-general","candidate":"John Denney","incumbent":"","party":"I","amountraised":6367.84,"cashonhand":23.35,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/pdf/494/14031353494/14031353494.pdf","rowNumber":18},{"contest":"Congressional District 7","interval":"Post-general","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":1603182.5,"cashonhand":73154.88,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00253187/979384/","rowNumber":19},{"contest":"Congressional District 7","interval":"Post-general","candidate":"Torrey Westrom","incumbent":"","party":"R","amountraised":992827.01,"cashonhand":11284.87,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00554352/980981/","rowNumber":20},{"contest":"Congressional District 8","interval":"Post-general","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":2101607.76,"cashonhand":103671.17,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00499053/979319/","rowNumber":21},{"contest":"Congressional District 8","interval":"Post-general","candidate":"Stewart Mills","incumbent":"","party":"R","amountraised":1634345.39,"cashonhand":12906.61,"from":"10/16/2014","to":"11/24/2014","reporturl":"http://docquery.fec.gov/cgi-bin/dcdev/forms/C00546739/979664/","rowNumber":22},{"contest":"Governor","interval":"Pre-general","candidate":"Mark Dayton","incumbent":"Y","party":"D","amountraised":3161682.35,"cashonhand":342305.38,"from":"1/1/2014","to":"10/20/2014","reporturl":"","rowNumber":23},{"contest":"Governor","interval":"Pre-general","candidate":"Jeff Johnson","incumbent":"","party":"R","amountraised":2184906.35,"cashonhand":453932.38,"from":"1/1/2014","to":"10/20/2014","reporturl":"","rowNumber":24},{"contest":"U.S. Senate","interval":"Pre-general","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":23348961.91,"cashonhand":2188798.6,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":25},{"contest":"U.S. Senate","interval":"Pre-general","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":6431643.34,"cashonhand":729508.07,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":26},{"contest":"Congressional District 1","interval":"Pre-general","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":1424274.79,"cashonhand":405460.82,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":27},{"contest":"Congressional District 1","interval":"Pre-general","candidate":"Jim Hagedorn","incumbent":"","party":"R","amountraised":185130.37,"cashonhand":24487.36,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":28},{"contest":"Congressional District 2","interval":"Pre-general","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":2662671.67,"cashonhand":1162866.6,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":29},{"contest":"Congressional District 2","interval":"Pre-general","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":878588.81,"cashonhand":150110.75,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":30},{"contest":"Congressional District 2","interval":"Pre-general","candidate":"Paula Overby","incumbent":"","party":"I","amountraised":200,"cashonhand":357.66,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":31},{"contest":"Congressional District 3","interval":"Pre-general","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":3087300.56,"cashonhand":1337528.41,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":32},{"contest":"Congressional District 3","interval":"Pre-general","candidate":"Sharon Sund","incumbent":"","party":"D","amountraised":71713.53,"cashonhand":28981.44,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":33},{"contest":"Congressional District 4","interval":"Pre-general","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":804543.56,"cashonhand":213598.73,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":34},{"contest":"Congressional District 4","interval":"Pre-general","candidate":"Sharna Wahlgren","incumbent":"","party":"R","amountraised":64209.5,"cashonhand":1456.37,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":35},{"contest":"Congressional District 5","interval":"Pre-general","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":1957740.43,"cashonhand":211272.84,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":36},{"contest":"Congressional District 5","interval":"Pre-general","candidate":"Doug Daggett","incumbent":"","party":"R","amountraised":39674.5,"cashonhand":14571.98,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":37},{"contest":"Congressional District 6","interval":"Pre-general","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":1727577.77,"cashonhand":175798.99,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":38},{"contest":"Congressional District 6","interval":"Pre-general","candidate":"Joe Perske","incumbent":"","party":"D","amountraised":170611.2,"cashonhand":10345.94,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":39},{"contest":"Congressional District 6","interval":"Pre-general","candidate":"John Denney","incumbent":"","party":"I","amountraised":"","cashonhand":868.28,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":40},{"contest":"Congressional District 7","interval":"Pre-general","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":1462112.5,"cashonhand":520953.58,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":41},{"contest":"Congressional District 7","interval":"Pre-general","candidate":"Torrey Westrom","incumbent":"","party":"R","amountraised":779390.23,"cashonhand":183678.16,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":42},{"contest":"Congressional District 8","interval":"Pre-general","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":1860617,"cashonhand":379516.16,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":43},{"contest":"Congressional District 8","interval":"Pre-general","candidate":"Stewart Mills","incumbent":"","party":"R","amountraised":1492528.08,"cashonhand":197913.61,"from":"10/1/2014","to":"10/15/2014","reporturl":"","rowNumber":44},{"contest":"Governor","interval":"September 2014","candidate":"Mark Dayton","incumbent":"Y","party":"D","amountraised":2734639.92,"cashonhand":1685490.55,"from":"1/1/2014","to":"9/16/2014","reporturl":"","rowNumber":45},{"contest":"Governor","interval":"September 2014","candidate":"Jeff Johnson","incumbent":"","party":"R","amountraised":1478136.9,"cashonhand":866161.23,"from":"1/1/2014","to":"9/16/2014","reporturl":"","rowNumber":46},{"contest":"U.S. Senate","interval":"Q3 2014","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":22682321.61,"cashonhand":2788621.42,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":47},{"contest":"U.S. Senate","interval":"Q3 2014","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":5912281.3,"cashonhand":1048802.68,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":48},{"contest":"Congressional District 1","interval":"Q3 2014","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":1389272.93,"cashonhand":564248.58,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":49},{"contest":"Congressional District 1","interval":"Q3 2014","candidate":"Jim Hagedorn","incumbent":"","party":"R","amountraised":159573.52,"cashonhand":40434.32,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":50},{"contest":"Congressional District 2","interval":"Q3 2014","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":2595221.67,"cashonhand":1759478.99,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":51},{"contest":"Congressional District 2","interval":"Q3 2014","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":828451.8,"cashonhand":278389.25,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":52},{"contest":"Congressional District 2","interval":"Q3 2014","candidate":"Paula Overby","incumbent":"","party":"I","amountraised":931.99,"cashonhand":452.66,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":53},{"contest":"Congressional District 3","interval":"Q3 2014","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":2955915.56,"cashonhand":1547181.25,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":54},{"contest":"Congressional District 3","interval":"Q3 2014","candidate":"Sharon Sund","incumbent":"","party":"D","amountraised":64615.32,"cashonhand":27873.44,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":55},{"contest":"Congressional District 4","interval":"Q3 2014","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":756077.46,"cashonhand":262528.15,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":56},{"contest":"Congressional District 4","interval":"Q3 2014","candidate":"Sharna Wahlgren","incumbent":"","party":"R","amountraised":62984.5,"cashonhand":7799.36,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":57},{"contest":"Congressional District 5","interval":"Q3 2014","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":1917399.93,"cashonhand":243862.35,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":58},{"contest":"Congressional District 5","interval":"Q3 2014","candidate":"Doug Daggett","incumbent":"","party":"R","amountraised":34624.5,"cashonhand":11738.66,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":59},{"contest":"Congressional District 6","interval":"Q3 2014","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":1560524.49,"cashonhand":216086.76,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":60},{"contest":"Congressional District 6","interval":"Q3 2014","candidate":"Joe Perske","incumbent":"","party":"D","amountraised":159286.2,"cashonhand":67820.32,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":61},{"contest":"Congressional District 6","interval":"Q3 2014","candidate":"John Denney","incumbent":"","party":"I","amountraised":5414.65,"cashonhand":1426.18,"from":"7/1/2014","to":"9/30/2014","reporturl":"","rowNumber":62},{"contest":"Congressional District 7","interval":"Q3 2014","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":1433947.5,"cashonhand":761947.16,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":63},{"contest":"Congressional District 7","interval":"Q3 2014","candidate":"Torrey Westrom","incumbent":"","party":"R","amountraised":715109.23,"cashonhand":399480.96,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":64},{"contest":"Congressional District 8","interval":"Q3 2014","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":1736493.01,"cashonhand":525695.38,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":65},{"contest":"Congressional District 8","interval":"Q3 2014","candidate":"Stewart Mills","incumbent":"","party":"R","amountraised":1370590.08,"cashonhand":254940.74,"from":"7/24/2014","to":"9/30/2014","reporturl":"","rowNumber":66},{"contest":"Governor","interval":"Pre-primary","candidate":"Mark Dayton","incumbent":"Y","party":"D","amountraised":1678442.27,"cashonhand":847065.04,"from":"1/1/2014","to":"7/21/2014","reporturl":"","rowNumber":67},{"contest":"Governor","interval":"Pre-primary","candidate":"Scott Honour","incumbent":"","party":"R","amountraised":1760468.98,"cashonhand":542242.77,"from":"1/1/2014","to":"7/21/2014","reporturl":"","rowNumber":68},{"contest":"Governor","interval":"Pre-primary","candidate":"Kurt Zellers","incumbent":"","party":"R","amountraised":661704.78,"cashonhand":145603.67,"from":"1/1/2014","to":"7/21/2014","reporturl":"","rowNumber":69},{"contest":"Governor","interval":"Pre-primary","candidate":"Jeff Johnson","incumbent":"","party":"R","amountraised":455700.9,"cashonhand":122886.49,"from":"1/1/2014","to":"7/21/2014","reporturl":"","rowNumber":70},{"contest":"Governor","interval":"Pre-primary","candidate":"Marty Seifert","incumbent":"","party":"R","amountraised":343959.82,"cashonhand":71018.32,"from":"1/1/2014","to":"7/21/2014","reporturl":"","rowNumber":71},{"contest":"U.S. Senate","interval":"Pre-primary","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":19359704.59,"cashonhand":4345950.85,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":72},{"contest":"U.S. Senate","interval":"Pre-primary","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":4167592.1,"cashonhand":1363037.75,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":73},{"contest":"Congressional District 1","interval":"Pre-primary","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":1087952.86,"cashonhand":522766.43,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":74},{"contest":"Congressional District 1","interval":"Pre-primary","candidate":"Jim Hagedorn","incumbent":"","party":"R","amountraised":85800,"cashonhand":9104.31,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":75},{"contest":"Congressional District 1","interval":"Pre-primary","candidate":"Aaron Miller","incumbent":"","party":"R","amountraised":141665.3,"cashonhand":69909.95,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":76},{"contest":"Congressional District 2","interval":"Pre-primary","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":2169469.81,"cashonhand":1692776.39,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":77},{"contest":"Congressional District 2","interval":"Pre-primary","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":609987.01,"cashonhand":270453.76,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":78},{"contest":"Congressional District 2","interval":"Pre-primary","candidate":"Paula Overby","incumbent":"","party":"I","amountraised":0,"cashonhand":0,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":79},{"contest":"Congressional District 3","interval":"Pre-primary","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":2506496.06,"cashonhand":2268923.54,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":80},{"contest":"Congressional District 3","interval":"Pre-primary","candidate":"Sharon Sund","incumbent":"","party":"D","amountraised":94445.38,"cashonhand":17848.79,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":81},{"contest":"Congressional District 4","interval":"Pre-primary","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":621412.62,"cashonhand":236234.81,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":82},{"contest":"Congressional District 4","interval":"Pre-primary","candidate":"Sharna Wahlgren","incumbent":"","party":"R","amountraised":51859.51,"cashonhand":14187.38,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":83},{"contest":"Congressional District 5","interval":"Pre-primary","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":1612600.85,"cashonhand":216940.9,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":84},{"contest":"Congressional District 5","interval":"Pre-primary","candidate":"Doug Daggett","incumbent":"","party":"R","amountraised":14283.5,"cashonhand":5115.81,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":85},{"contest":"Congressional District 6","interval":"Pre-primary","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":1165962.87,"cashonhand":160913.9,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":86},{"contest":"Congressional District 6","interval":"Pre-primary","candidate":"Rhonda Sivarajah","incumbent":"","party":"R","amountraised":86102.09,"cashonhand":194996.34,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":87},{"contest":"Congressional District 6","interval":"Pre-primary","candidate":"Joe Perske","incumbent":"","party":"D","amountraised":94489.2,"cashonhand":38234.05,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":88},{"contest":"Congressional District 7","interval":"Pre-primary","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":1089263.69,"cashonhand":748848.09,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":89},{"contest":"Congressional District 7","interval":"Pre-primary","candidate":"Torrey Westrom","incumbent":"","party":"R","amountraised":466538.68,"cashonhand":283935.93,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":90},{"contest":"Congressional District 8","interval":"Pre-primary","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":1177902.79,"cashonhand":624494.7,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":91},{"contest":"Congressional District 8","interval":"Pre-primary","candidate":"Stewart Mills","incumbent":"","party":"R","amountraised":1024400.95,"cashonhand":356617.98,"from":"7/1/2014","to":"7/23/2014","reporturl":"","rowNumber":92},{"contest":"U.S. Senate","interval":"Q2 2014","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":18459331.46,"cashonhand":5050355.82,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":93},{"contest":"U.S. Senate","interval":"Q2 2014","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":3966720.56,"cashonhand":2034394.14,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":94},{"contest":"U.S. Senate","interval":"Q2 2014","candidate":"Jim Abeler","incumbent":"","party":"R","amountraised":143399.52,"cashonhand":15669.78,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":95},{"contest":"Congressional District 1","interval":"Q2 2014","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":1059412.86,"cashonhand":541913.61,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":96},{"contest":"Congressional District 1","interval":"Q2 2014","candidate":"Jim Hagedorn","incumbent":"","party":"R","amountraised":74960,"cashonhand":11894.35,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":97},{"contest":"Congressional District 1","interval":"Q2 2014","candidate":"Aaron Miller","incumbent":"","party":"R","amountraised":135680.3,"cashonhand":107455.78,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":98},{"contest":"Congressional District 2","interval":"Q2 2014","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":2124281.26,"cashonhand":1686934.12,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":99},{"contest":"Congressional District 2","interval":"Q2 2014","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":569464.66,"cashonhand":288887.61,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":100},{"contest":"Congressional District 2","interval":"Q2 2014","candidate":"Paula Overby","incumbent":"","party":"I","amountraised":5310.44,"cashonhand":350.47,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":101},{"contest":"Congressional District 3","interval":"Q2 2014","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":2412294.06,"cashonhand":2200323.8,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":102},{"contest":"Congressional District 3","interval":"Q2 2014","candidate":"Sharon Sund","incumbent":"","party":"D","amountraised":76421.69,"cashonhand":29519.47,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":103},{"contest":"Congressional District 4","interval":"Q2 2014","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":614267.62,"cashonhand":249036.5,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":104},{"contest":"Congressional District 4","interval":"Q2 2014","candidate":"Sharna Wahlgren","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":105},{"contest":"Congressional District 5","interval":"Q2 2014","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":1546263.39,"cashonhand":196730.52,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":106},{"contest":"Congressional District 5","interval":"Q2 2014","candidate":"Doug Daggett","incumbent":"","party":"R","amountraised":13121,"cashonhand":5515.32,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":107},{"contest":"Congressional District 6","interval":"Q2 2014","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":1112159.74,"cashonhand":259929.85,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":108},{"contest":"Congressional District 6","interval":"Q2 2014","candidate":"Rhonda Sivarajah","incumbent":"","party":"R","amountraised":81773.69,"cashonhand":211212.37,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":109},{"contest":"Congressional District 6","interval":"Q2 2014","candidate":"Joe Perske","incumbent":"","party":"D","amountraised":77828,"cashonhand":46436.85,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":110},{"contest":"Congressional District 7","interval":"Q2 2014","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":1016006.29,"cashonhand":717296.11,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":111},{"contest":"Congressional District 7","interval":"Q2 2014","candidate":"Torrey Westrom","incumbent":"","party":"R","amountraised":430457.94,"cashonhand":327789.2,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":112},{"contest":"Congressional District 8","interval":"Q2 2014","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":1089281.57,"cashonhand":579186.33,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":113},{"contest":"Congressional District 8","interval":"Q2 2014","candidate":"Stewart Mills","incumbent":"","party":"R","amountraised":989307.95,"cashonhand":429104.87,"from":"4/1/2014","to":"6/30/2014","reporturl":"","rowNumber":114},{"contest":"Governor","interval":"May 2014","candidate":"Mark Dayton","incumbent":"Y","party":"D","amountraised":1433093.75,"cashonhand":753204.76,"from":"1/1/2014","to":"5/31/2014","reporturl":"","rowNumber":115},{"contest":"Governor","interval":"May 2014","candidate":"Scott Honour","incumbent":"","party":"R","amountraised":1153829.98,"cashonhand":226733.14,"from":"1/1/2014","to":"5/31/2014","reporturl":"","rowNumber":116},{"contest":"Governor","interval":"May 2014","candidate":"Kurt Zellers","incumbent":"","party":"R","amountraised":542610.28,"cashonhand":94827.45,"from":"1/1/2014","to":"5/31/2014","reporturl":"","rowNumber":117},{"contest":"Governor","interval":"May 2014","candidate":"Jeff Johnson","incumbent":"","party":"R","amountraised":285367.73,"cashonhand":32529.94,"from":"1/1/2014","to":"5/31/2014","reporturl":"","rowNumber":118},{"contest":"Governor","interval":"May 2014","candidate":"Marty Seifert","incumbent":"","party":"R","amountraised":290542.05,"cashonhand":104345.28,"from":"1/1/2014","to":"5/31/2014","reporturl":"","rowNumber":119},{"contest":"Governor","interval":"Q1 2014","candidate":"Mark Dayton","incumbent":"Y","party":"D","amountraised":1282608.11,"cashonhand":733114.86,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":120},{"contest":"Governor","interval":"Q1 2014","candidate":"Scott Honour","incumbent":"","party":"R","amountraised":832755,"cashonhand":63693.73,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":121},{"contest":"Governor","interval":"Q1 2014","candidate":"Kurt Zellers","incumbent":"","party":"R","amountraised":494008.11,"cashonhand":79777.01,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":122},{"contest":"Governor","interval":"Q1 2014","candidate":"Jeff Johnson","incumbent":"","party":"R","amountraised":274716.73,"cashonhand":141710.77,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":123},{"contest":"Governor","interval":"Q1 2014","candidate":"Dave Thompson","incumbent":"","party":"R","amountraised":191537.72,"cashonhand":37695.72,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":124},{"contest":"Governor","interval":"Q1 2014","candidate":"Marty Seifert","incumbent":"","party":"R","amountraised":214279.05,"cashonhand":139082.95,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":125},{"contest":"Governor","interval":"Q1 2014","candidate":"Rob Farnsworth","incumbent":"","party":"R","amountraised":7855.01,"cashonhand":315.83,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":126},{"contest":"U.S. Senate","interval":"Q1 2014","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":15129502.21,"cashonhand":5933851.39,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":127},{"contest":"U.S. Senate","interval":"Q1 2014","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":2851538,"cashonhand":1791300.89,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":128},{"contest":"U.S. Senate","interval":"Q1 2014","candidate":"Chris Dahlberg","incumbent":"","party":"R","amountraised":147422.78,"cashonhand":39123.15,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":129},{"contest":"U.S. Senate","interval":"Q1 2014","candidate":"Julianne Ortman","incumbent":"","party":"R","amountraised":611048.93,"cashonhand":233248.15,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":130},{"contest":"U.S. Senate","interval":"Q1 2014","candidate":"Jim Abeler","incumbent":"","party":"R","amountraised":109250.03,"cashonhand":13883.19,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":131},{"contest":"Congressional District 1","interval":"Q1 2014","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":827830.23,"cashonhand":411216.6,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":132},{"contest":"Congressional District 1","interval":"Q1 2014","candidate":"Mike Benson","incumbent":"","party":"R","amountraised":77526.73,"cashonhand":6444.1,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":133},{"contest":"Congressional District 1","interval":"Q1 2014","candidate":"Jim Hagedorn","incumbent":"","party":"R","amountraised":33470,"cashonhand":4350.44,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":134},{"contest":"Congressional District 1","interval":"Q1 2014","candidate":"Aaron Miller","incumbent":"","party":"R","amountraised":32007.5,"cashonhand":43164.48,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":135},{"contest":"Congressional District 2","interval":"Q1 2014","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":1828844.32,"cashonhand":1658175.61,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":136},{"contest":"Congressional District 2","interval":"Q1 2014","candidate":"David Gerson","incumbent":"","party":"R","amountraised":15812.34,"cashonhand":6642.99,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":137},{"contest":"Congressional District 2","interval":"Q1 2014","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":417918.62,"cashonhand":238211.02,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":138},{"contest":"Congressional District 2","interval":"Q1 2014","candidate":"Thomas Craft","incumbent":"","party":"D","amountraised":22676.92,"cashonhand":2965.89,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":139},{"contest":"Congressional District 2","interval":"Q1 2014","candidate":"Paula Overby","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":140},{"contest":"Congressional District 3","interval":"Q1 2014","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":1973339.47,"cashonhand":1979136.02,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":141},{"contest":"Congressional District 3","interval":"Q1 2014","candidate":"Sharon Sund","incumbent":"","party":"D","amountraised":33577.66,"cashonhand":28834.98,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":142},{"contest":"Congressional District 4","interval":"Q1 2014","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":499304.62,"cashonhand":214079.21,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":143},{"contest":"Congressional District 5","interval":"Q1 2014","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":1197323.82,"cashonhand":229460.28,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":144},{"contest":"Congressional District 6","interval":"Q1 2014","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":833203.94,"cashonhand":252737.63,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":145},{"contest":"Congressional District 6","interval":"Q1 2014","candidate":"Phil Krinkie","incumbent":"","party":"R","amountraised":69370.57,"cashonhand":315743.68,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":146},{"contest":"Congressional District 6","interval":"Q1 2014","candidate":"Rhonda Sivarajah","incumbent":"","party":"R","amountraised":65147.02,"cashonhand":214808.37,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":147},{"contest":"Congressional District 6","interval":"Q1 2014","candidate":"Joe Perske","incumbent":"","party":"D","amountraised":10494.2,"cashonhand":22293,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":148},{"contest":"Congressional District 6","interval":"Q1 2014","candidate":"Jim Read","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":149},{"contest":"Congressional District 6","interval":"Q1 2014","candidate":"Judy Adams","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":150},{"contest":"Congressional District 7","interval":"Q1 2014","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":745742.43,"cashonhand":522650.49,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":151},{"contest":"Congressional District 7","interval":"Q1 2014","candidate":"Torrey Westrom","incumbent":"","party":"R","amountraised":204458.69,"cashonhand":170728.95,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":152},{"contest":"Congressional District 8","interval":"Q1 2014","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":813938.31,"cashonhand":478215.97,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":153},{"contest":"Congressional District 8","interval":"Q1 2014","candidate":"Stewart Mills","incumbent":"","party":"R","amountraised":650830.83,"cashonhand":355738.89,"from":"1/1/2014","to":"3/31/2014","reporturl":"","rowNumber":154},{"contest":"Governor","interval":2013,"candidate":"Mark Dayton","incumbent":"Y","party":"D","amountraised":1086739.75,"cashonhand":772062.18,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":155},{"contest":"Governor","interval":2013,"candidate":"Scott Honour","incumbent":"","party":"R","amountraised":596680,"cashonhand":14251.94,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":156},{"contest":"Governor","interval":2013,"candidate":"Kurt Zellers","incumbent":"","party":"R","amountraised":402600.97,"cashonhand":115864.07,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":157},{"contest":"Governor","interval":2013,"candidate":"Jeff Johnson","incumbent":"","party":"R","amountraised":242689.73,"cashonhand":168874.85,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":158},{"contest":"Governor","interval":2013,"candidate":"Dave Thompson","incumbent":"","party":"R","amountraised":124648.72,"cashonhand":50283.48,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":159},{"contest":"Governor","interval":2013,"candidate":"Marty Seifert","incumbent":"","party":"R","amountraised":150151.83,"cashonhand":138474.7,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":160},{"contest":"Governor","interval":2013,"candidate":"Rob Farnsworth","incumbent":"","party":"R","amountraised":4020,"cashonhand":1636.36,"from":"9/30/2013","to":"12/31/2013","reporturl":"","rowNumber":161},{"contest":"U.S. Senate","interval":"Q4 2013","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":12407312.94,"cashonhand":4839250.22,"from":"10/1/2013","to":"12/31/2013","reporturl":"","rowNumber":162},{"contest":"U.S. Senate","interval":"Q4 2013","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":2248296.44,"cashonhand":1684803.26,"from":"10/1/2013","to":"12/31/2013","reporturl":"","rowNumber":163},{"contest":"U.S. Senate","interval":"Q4 2013","candidate":"Chris Dahlberg","incumbent":"","party":"R","amountraised":103048,"cashonhand":46967.33,"from":"10/1/2013","to":"12/31/2013","reporturl":"","rowNumber":164},{"contest":"U.S. Senate","interval":"Q4 2013","candidate":"Julianne Ortman","incumbent":"","party":"R","amountraised":234429.63,"cashonhand":114119.11,"from":"10/1/2013","to":"12/31/2013","reporturl":"","rowNumber":165},{"contest":"U.S. Senate","interval":"Q4 2013","candidate":"Jim Abeler","incumbent":"","party":"R","amountraised":81580,"cashonhand":24806.45,"from":"10/1/2013","to":"12/31/2013","reporturl":"","rowNumber":166},{"contest":"Congressional District 1","interval":"Q4 2013","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":637347.19,"cashonhand":293490.85,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00409409/905770/","rowNumber":167},{"contest":"Congressional District 1","interval":"Q4 2013","candidate":"Mike Benson","incumbent":"","party":"R","amountraised":60447.73,"cashonhand":28966.2,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00546945/903598/","rowNumber":168},{"contest":"Congressional District 1","interval":"Q4 2013","candidate":"Jim Hagedorn","incumbent":"","party":"R","amountraised":36590,"cashonhand":15998.15,"from":"1/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00550707/904155/","rowNumber":169},{"contest":"Congressional District 1","interval":"Q4 2013","candidate":"Aaron Miller","incumbent":"","party":"R","amountraised":24457,"cashonhand":40994.03,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00548693/903302/","rowNumber":170},{"contest":"Congressional District 2","interval":"Q4 2013","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":1558216.98,"cashonhand":1620031.68,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00326629/904336/","rowNumber":171},{"contest":"Congressional District 2","interval":"Q4 2013","candidate":"David Gerson","incumbent":"","party":"R","amountraised":13569.03,"cashonhand":3896.07,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00523738/906556/","rowNumber":172},{"contest":"Congressional District 2","interval":"Q4 2013","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":336839.54,"cashonhand":203510.59,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00518811/905229/","rowNumber":173},{"contest":"Congressional District 2","interval":"Q4 2013","candidate":"Thomas Craft","incumbent":"","party":"D","amountraised":22676.92,"cashonhand":8978.66,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00546465/903334/","rowNumber":174},{"contest":"Congressional District 2","interval":"Q4 2013","candidate":"Paula Overby","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":175},{"contest":"Congressional District 3","interval":"Q4 2013","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":1528650.98,"cashonhand":1701994.5,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00439661/905245/","rowNumber":176},{"contest":"Congressional District 4","interval":"Q4 2013","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":354652.62,"cashonhand":124088.88,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00354688/904337/","rowNumber":177},{"contest":"Congressional District 5","interval":"Q4 2013","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":909374.2,"cashonhand":163624.66,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00422410/904772/","rowNumber":178},{"contest":"Congressional District 6","interval":"Q4 2013","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":626299.61,"cashonhand":335725.73,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00545749/904786/","rowNumber":179},{"contest":"Congressional District 6","interval":"Q4 2013","candidate":"Phil Krinkie","incumbent":"","party":"R","amountraised":57328.15,"cashonhand":290916.12,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00547786/906234/","rowNumber":180},{"contest":"Congressional District 6","interval":"Q4 2013","candidate":"Rhonda Sivarajah","incumbent":"","party":"R","amountraised":62407.02,"cashonhand":192505.47,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00546283/902822/","rowNumber":181},{"contest":"Congressional District 6","interval":"Q4 2013","candidate":"Jim Read","incumbent":"","party":"D","amountraised":33778,"cashonhand":24134.19,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00551010/903997/","rowNumber":182},{"contest":"Congressional District 6","interval":"Q4 2013","candidate":"Joe Perske","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":183},{"contest":"Congressional District 6","interval":"Q4 2013","candidate":"Judy Adams","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":184},{"contest":"Congressional District 7","interval":"Q4 2013","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":527827.63,"cashonhand":357686.97,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00253187/904159/","rowNumber":185},{"contest":"Congressional District 7","interval":"Q4 2013","candidate":"Torrey Westrom","incumbent":"","party":"R","amountraised":84346.63,"cashonhand":83677.6,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00554352/904407/","rowNumber":186},{"contest":"Congressional District 8","interval":"Q4 2013","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":562855.21,"cashonhand":298061.72,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00499053/905763/","rowNumber":187},{"contest":"Congressional District 8","interval":"Q4 2013","candidate":"Stewart Mills","incumbent":"","party":"R","amountraised":448390.28,"cashonhand":306289.75,"from":"10/1/2013","to":"12/31/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00546739/905793/","rowNumber":188},{"contest":"U.S. Senate","interval":"Q1 2013","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":5112997.21,"cashonhand":2034843.19,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/024/13020432024/13020432024.pdf","rowNumber":189},{"contest":"Congressional District 1","interval":"Q1 2013","candidate":"Tim Walz","incumbent":"","party":"D","amountraised":102298.16,"cashonhand":86395.55,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/787/13961644787/13961644787.pdf","rowNumber":190},{"contest":"Congressional District 2","interval":"Q1 2013","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":257833.14,"cashonhand":750130.39,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/335/13961254335/13961254335.pdf","rowNumber":191},{"contest":"Congressional District 2","interval":"Q1 2013","candidate":"David Gerson","incumbent":"","party":"R","amountraised":425,"cashonhand":4920.91,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/140/13963178140/13963178140.pdf","rowNumber":192},{"contest":"Congressional District 2","interval":"Q1 2013","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":1560,"cashonhand":5514.7,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/029/13961610029/13961610029.pdf","rowNumber":193},{"contest":"Congressional District 3","interval":"Q1 2013","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":362943.13,"cashonhand":943158.45,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/437/13964077437/13964077437.pdf","rowNumber":194},{"contest":"Congressional District 4","interval":"Q1 2013","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":103375,"cashonhand":62842.08,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/160/13940549160/13940549160.pdf","rowNumber":195},{"contest":"Congressional District 5","interval":"Q1 2013","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":220583.63,"cashonhand":86688.78,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/308/13961609308/13961609308.pdf","rowNumber":196},{"contest":"Congressional District 7","interval":"Q1 2013","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":187230.62,"cashonhand":160065.97,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/081/13961279081/13961279081.pdf","rowNumber":197},{"contest":"Congressional District 7","interval":"Q1 2013","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":154220.88,"cashonhand":118938.46,"from":"1/1/2013","to":"3/31/2013","reporturl":"http://docquery.fec.gov/pdf/045/13962134045/13962134045.pdf","rowNumber":198},{"contest":"U.S. Senate","interval":"Q2 2013","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":6772007.69,"cashonhand":3005162.28,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/001/13020440001/13020440001.pdf","rowNumber":199},{"contest":"U.S. Senate","interval":"Q2 2013","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":763823.4,"cashonhand":741446.62,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/257/13020350257/13020350257.pdf","rowNumber":200},{"contest":"Congressional District 1","interval":"Q2 2013","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":302860.18,"cashonhand":173877.67,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/970/13964071970/13964071970.pdf","rowNumber":201},{"contest":"Congressional District 2","interval":"Q2 2013","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":740436.12,"cashonhand":1105914.77,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/837/13941279837/13941279837.pdf","rowNumber":202},{"contest":"Congressional District 2","interval":"Q2 2013","candidate":"David Gerson","incumbent":"","party":"R","amountraised":3097,"cashonhand":5700.48,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/896/14960019896/14960019896.pdf","rowNumber":203},{"contest":"Congressional District 2","interval":"Q2 2013","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":131620.21,"cashonhand":93161.38,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/534/13964059534/13964059534.pdf","rowNumber":204},{"contest":"Congressional District 3","interval":"Q2 2013","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":859255.67,"cashonhand":1296984.71,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/431/14940086431/14940086431.pdf","rowNumber":205},{"contest":"Congressional District 4","interval":"Q2 2013","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":162291,"cashonhand":58057.01,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/041/13964082041/13964082041.pdf","rowNumber":206},{"contest":"Congressional District 5","interval":"Q2 2013","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":410674.03,"cashonhand":140032.27,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/300/13964078300/13964078300.pdf","rowNumber":207},{"contest":"Congressional District 6","interval":"Q2 2013","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":220946.4,"cashonhand":198910.76,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/132/13941766132/13941766132.pdf","rowNumber":208},{"contest":"Congressional District 6","interval":"Q2 2013","candidate":"Rhonda Sivarajah","incumbent":"","party":"R","amountraised":19066,"cashonhand":15967.04,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/656/13941148656/13941148656.pdf","rowNumber":209},{"contest":"Congressional District 7","interval":"Q2 2013","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":281000.62,"cashonhand":205097.9,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/324/13964054324/13964054324.pdf","rowNumber":210},{"contest":"Congressional District 8","interval":"Q2 2013","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":288985.22,"cashonhand":194576.03,"from":"4/1/2013","to":"6/30/2013","reporturl":"http://docquery.fec.gov/pdf/179/13964086179/13964086179.pdf","rowNumber":211},{"contest":"U.S. Senate","interval":"Q3 2013","candidate":"Al Franken","incumbent":"Y","party":"D","amountraised":8619462.99,"cashonhand":3893286.11,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/927/13020441927/13020441927.pdf","rowNumber":212},{"contest":"U.S. Senate","interval":"Q3 2013","candidate":"Mike McFadden","incumbent":"","party":"R","amountraised":1468840.99,"cashonhand":1252087.2,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/966/13020511966/13020511966.pdf","rowNumber":213},{"contest":"U.S. Senate","interval":"Q3 2013","candidate":"Julianne Ortman","incumbent":"","party":"R","amountraised":119466,"cashonhand":88121.1,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/664/13020491664/13020491664.pdf","rowNumber":214},{"contest":"U.S. Senate","interval":"Q3 2013","candidate":"Jim Abeler","incumbent":"","party":"R","amountraised":54854,"cashonhand":34568.7,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/789/13020491789/13020491789.pdf","rowNumber":215},{"contest":"U.S. Senate","interval":"Q3 2013","candidate":"Chris Dahlberg","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":216},{"contest":"Congressional District 1","interval":"Q3 2013","candidate":"Tim Walz","incumbent":"Y","party":"D","amountraised":479508.7,"cashonhand":238512.29,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/703/13941800703/13941800703.pdf","rowNumber":217},{"contest":"Congressional District 1","interval":"Q3 2013","candidate":"Mike Benson","incumbent":"","party":"R","amountraised":28158.36,"cashonhand":14707.85,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/941/13964697941/13964697941.pdf","rowNumber":218},{"contest":"Congressional District 1","interval":"Q3 2013","candidate":"Jim Hagedorn","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":219},{"contest":"Congressional District 1","interval":"Q3 2013","candidate":"Aaron Miller","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":220},{"contest":"Congressional District 2","interval":"Q3 2013","candidate":"John Kline","incumbent":"Y","party":"R","amountraised":1107528.4,"cashonhand":1307904.91,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/813/13941783813/13941783813.pdf","rowNumber":221},{"contest":"Congressional District 2","interval":"Q3 2013","candidate":"David Gerson","incumbent":"","party":"R","amountraised":5182,"cashonhand":2000.05,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/041/14960020041/14960020041.pdf","rowNumber":222},{"contest":"Congressional District 2","interval":"Q3 2013","candidate":"Mike Obermueller","incumbent":"","party":"D","amountraised":204353.2,"cashonhand":119453.55,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/871/13941821871/13941821871.pdf","rowNumber":223},{"contest":"Congressional District 2","interval":"Q3 2013","candidate":"Paula Overby","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":224},{"contest":"Congressional District 2","interval":"Q3 2013","candidate":"Thomas Craft","incumbent":"","party":"D","amountraised":22230.78,"cashonhand":13508.7,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/279/13941844279/13941844279.pdf","rowNumber":225},{"contest":"Congressional District 3","interval":"Q3 2013","candidate":"Erik Paulsen","incumbent":"Y","party":"R","amountraised":1235371.01,"cashonhand":1526807.21,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/598/14940086598/14940086598.pdf","rowNumber":226},{"contest":"Congressional District 4","interval":"Q3 2013","candidate":"Betty McCollum","incumbent":"Y","party":"D","amountraised":261510.62,"cashonhand":89076.71,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/090/13964683090/13964683090.pdf","rowNumber":227},{"contest":"Congressional District 5","interval":"Q3 2013","candidate":"Keith Ellison","incumbent":"Y","party":"D","amountraised":719932.99,"cashonhand":186248.91,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/974/13941799974/13941799974.pdf","rowNumber":228},{"contest":"Congressional District 6","interval":"Q3 2013","candidate":"Tom Emmer","incumbent":"","party":"R","amountraised":379216.9,"cashonhand":280431.33,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://query.nictusa.com/cgi-bin/dcdev/forms/C00545749/903848/","rowNumber":229},{"contest":"Congressional District 6","interval":"Q3 2013","candidate":"Phil Krinkie","incumbent":"","party":"R","amountraised":38243.01,"cashonhand":314880.29,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/298/14940037298/14940037298.pdf","rowNumber":230},{"contest":"Congressional District 6","interval":"Q3 2013","candidate":"Rhonda Sivarajah","incumbent":"","party":"R","amountraised":49128.31,"cashonhand":184332.22,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/953/13964790953/13964790953.pdf","rowNumber":231},{"contest":"Congressional District 6","interval":"Q3 2013","candidate":"Jim Read","incumbent":"","party":"D","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":232},{"contest":"Congressional District 7","interval":"Q3 2013","candidate":"Collin Peterson","incumbent":"Y","party":"D","amountraised":363193.12,"cashonhand":227388.06,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/893/13964634893/13964634893.pdf","rowNumber":233},{"contest":"Congressional District 7","interval":"Q3 2013","candidate":"Torrey Westrom","incumbent":"","party":"R","amountraised":"","cashonhand":"","from":"","to":"","reporturl":"","rowNumber":234},{"contest":"Congressional District 8","interval":"Q3 2013","candidate":"Rick Nolan","incumbent":"Y","party":"D","amountraised":418457.48,"cashonhand":261059.73,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/692/13941827692/13941827692.pdf","rowNumber":235},{"contest":"Congressional District 8","interval":"Q3 2013","candidate":"Stewart Mills","incumbent":"","party":"R","amountraised":243826.3,"cashonhand":234442.53,"from":"7/1/2013","to":"9/30/2013","reporturl":"http://docquery.fec.gov/pdf/410/13964790410/13964790410.pdf","rowNumber":236}]}';});

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

