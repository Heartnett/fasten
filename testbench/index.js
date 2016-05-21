
fasten.component({
  name: "component1",
  model: {
    value: 2
  },
  view: "<div>The model value is: ${value}</div>",
  deps: ["timer"],
  controller: function(timer) {
    var $this = this;
    timer.onTicked(function() {
      /*count++;
      if(count === 10) {
        timer.stop();
        deferred.resolve("The timer stopped.");
      }*/
      $this.value++;
    });
    timer.start(1000);
  }
});
