
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
