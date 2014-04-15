
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
